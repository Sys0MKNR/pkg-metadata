const path = require('path')
const util = require('util')

const {
  execFile
} = require('child_process')

const execFileP = util.promisify(execFile)

const fetch = require('node-fetch')
const fs = require('fs-extra')
const unzipper = require('unzipper')

const JsDiff = require('diff')
const sizeOf = require('image-size')
const sharp = require('sharp')
const icongen = require('icon-gen')

const RH_URL = 'http://www.angusj.com/resourcehacker/resource_hacker.zip'

/** Class representing a PKGMetadata instance. */
class PKGMetadata {
  constructor (opts) {
    const {
      keepTMP,
      targets,
      metaData,
      icon,
      pkg,
      rcData,
      rhPath,
      rcFilePath,
      resFilePath,
      pkgCachePath

    } = opts

    this.keepTMP = keepTMP

    this.unparsedTargets = targets || ['host']
    // this.versions = targets

    // this.nodeVersion = nodeVersion || process.version.slice(1)
    // this.arch = arch || 'x64'

    this.tmpPath = path.join(__dirname, '.tmp')
    this.binTMPPath = path.join(this.tmpPath, 'bin')
    this.cachePath = path.join(__dirname, '.cache')
    this.resPath = path.join(__dirname, 'res')
    this.pkgCachePath = pkgCachePath || path.join(this.cachePath, 'pkg-cache')
    process.env.PKG_CACHE_PATH = this.pkgCachePath

    this.metaData = metaData || {}
    this.icon = icon ? path.resolve(icon) : null
    this.rcData = rcData || {}

    this.pkg = pkg

    // this.baseBinName = `fetched-v${this.nodeVersion}-win-${this.arch}`
    // this.baseBinPath = path.join(this.pkgCachePath, 'v2.6', this.baseBinName)
    // this.baseBinPathTMP = path.join(this.tmpPath, this.baseBinName)
    this.rhPath = rhPath

    this.rcFilePath = rcFilePath
    this.resFilePath = resFilePath
  }

  async run () {
    console.log('Start...')

    await ensureDir([
      this.cachePath,
      this.tmpPath,
      this.binTMPPath,
      this.pkgCachePath
    ])

    // scuffed hack bc env gets used too early otherwise
    this.pkgFetch = require('pkg-fetch')
    this.pkgExec = require('pkg').exec

    this.parseTargets()

    await this.fetchResourceHacker()
    await this.fetchBinaries()
    await this.generateRES()
    await this.editMetaData()

    if (this.pkg) {
      await this.runPKG()
      await this.cleanup()
    }
  }

  async fetchResourceHacker () {
    console.log('fetch ResourceHacker..')
    if (this.rhPath) {
      this.rhPath = path.resolve(this.rhPath)
      return
    }

    const rhPathDir = path.join(this.cachePath, 'rh')
    const rhPathZip = rhPathDir + '.zip'

    this.rhPath = path.join(rhPathDir, 'ResourceHacker.exe')

    if (!fs.existsSync(rhPathZip)) {
      const res = await fetch(RH_URL)
      const zipOut = fs.createWriteStream(rhPathZip)
      res.body.pipe(zipOut)
      await waitOnStreamEnd(zipOut)
    }

    if (!fs.existsSync(this.rhPath)) {
      const zipIn = fs.createReadStream(rhPathZip)
      const exeOut = unzipper.Extract({
        path: rhPathDir
      })
      zipIn.pipe(exeOut)
      await waitOnStreamEnd(exeOut)
    }
  }

  async fetchBinaries () {
    console.log('Fetch base binaries...')
    console.log('targets: ')
    console.log(this.targets)

    for (const target of this.targets) {
      target.fullPath = await this.pkgFetch.need(target.target)
      target.fileName = path.basename(target.fullPath)
    }
  }

  generateRCData () {
    console.log('Generate RC data...')
    const exeName = this.metaData.name + '.exe'

    const customData = {
      FileDescription: this.metaData.descriptios,
      FileVersion: this.metaData.version,
      InternalName: exeName,
      LegalCopyright: this.metaData.legal,
      OriginalFilename: exeName,
      ProductName: this.metaData.name,
      ProductVersion: this.metaData.version
    }

    return {
      ...removeNullProperties(customData),
      ...removeNullProperties(this.rcData)
    }
  }

  async generateRES () {
    if (this.resFilePath) {
      return
    }
    console.log('generate res file...')

    this.resFilePath = path.join(this.tmpPath, 'bin.res')

    if (!this.rcFilePath) {
      this.rcFilePath = path.join(this.tmpPath, 'bin.rc')
      const finalRCDAta = this.generateRCData()

      console.log(finalRCDAta)

      let rcSample = await fs.readFile(path.join(this.resPath, 'q_sample.rc'))
      rcSample = rcSample.toString()

      let rc = rcSample.replace('#fileVersion#', toCommaVersion(finalRCDAta.FileVersion))
      rc = rc.replace('#productVersion#', toCommaVersion(finalRCDAta.ProductVersion))

      let block = ''

      for (const [key, value] of Object.entries(finalRCDAta)) {
        block += `\t\tVALUE "${key}", "${value}"\n`
      }

      rc = rc.replace('#fileInfoBlock#', block)

      await fs.writeFile(this.rcFilePath, rc)
    }

    await this.execRHInternal({
      open: this.rcFilePath,
      save: this.resFilePath,
      action: 'compile'
    })
  }

  async editMetaData () {
    console.log('Edit metadata...')

    if (this.icon) {
      console.log('Prepare icon...')
      const iconType = this.icon.split('.').pop()
      if (iconType === 'ico') {
        this.finalIcon = this.icon
      } else {
        this.finalIcon = await this.prepareIcon()
      }
    }

    for (const target of this.targets) {
      if (target.target.platform !== 'win') {
        continue
      }

      console.log('Edit base binary of target: ' + target.name)

      target.tmpPath = path.join(this.binTMPPath, target.fileName)

      await fs.copyFile(target.fullPath, target.tmpPath)

      await this.execRHInternal({
        open: target.fullPath,
        save: target.fullPath,
        action: 'addoverwrite',
        resource: this.resFilePath
      })

      if (this.icon) {
        await this.execRHInternal({
          open: target.fullPath,
          save: target.fullPath,
          action: 'addoverwrite',
          resource: this.finalIcon,
          mask: 'ICONGROUP,1,'
        })
      }
    }
  }

  async prepareIcon () {
    console.log('Generate icon...')
    if (!this.icon) {
      return
    }

    const stat = await fs.lstat(this.icon)

    const icons = {
      16: null,
      24: null,
      32: null,
      48: null,
      64: null,
      128: null,
      256: null
    }

    const tmpIcons = {}

    let biggestIcon = 0

    if (stat.isFile()) {
      const dimensions = sizeOf(this.icon)
      tmpIcons[dimensions.width] = this.icon
      biggestIcon = dimensions.width
    } else {
      const iconPaths = await fs.readdir(this.icon)

      iconPaths.forEach(i => {
        const name = i.split('.')[0]

        const size = parseInt(name)

        biggestIcon = size > biggestIcon ? size : biggestIcon

        tmpIcons[name] = path.join(this.icon, i)
      })
    }

    Object.keys(tmpIcons).filter(key => key in icons).forEach(key => {
      icons[key] = tmpIcons[key]
    })

    const biggestIconBuffer = await fs.readFile(icons[biggestIcon])
    const tmpIconPath = path.join(this.tmpPath, 'icon')
    const tmpIconRawPath = path.join(tmpIconPath, 'raw')

    await fs.ensureDir(tmpIconRawPath)

    await Promise.all(Object.entries(icons).map(async ([size, i]) => {
      size = parseInt(size)
      const iIconPath = path.join(tmpIconRawPath, size + '.png')
      if (i === null) {
        await sharp(biggestIconBuffer)
          .png()
          .resize(size, size)
          .toFile(iIconPath)
      } else {
        await fs.copyFile(i, iIconPath)
      }
    }))

    const tmpIconFinalPath = path.join(tmpIconPath, 'final')
    await fs.ensureDir(tmpIconFinalPath)

    await icongen(tmpIconRawPath, tmpIconFinalPath, {
      report: true,
      ico: {
        name: 'icon'
      }
    })

    return path.join(tmpIconFinalPath, 'icon.ico')
  }

  async runPKG () {
    console.log('Run pkg...')

    let args = this.pkg.args

    if (!args) {
      args = [
        this.pkg.src,
        '--target',
        this.unparsedTargets.join(','),
        '--out-path',
        this.pkg.out
      ]
    }

    await this.pkgExec(args)
  }

  async cleanup () {
    console.log('cleanup')

    for (const target of this.targets.filter(t => t.binTMPPath)) {
      await fs.copyFile(target.binTMPPath, target.fullPath)
    }

    if (!this.keepTMP) {
      await fs.remove(this.tmpPath)
    }
  }

  execRHInternal (opts) {
    return PKGMetadata.execRH(this.rhPath, opts)
  }

  async compareExeWithRC (exe, rc) {
    console.log(exe)
    console.log(rc)

    const tmpRCFile = path.join(this.tmpPath, 'exeRc.rc')

    await this.execRHInternal({
      open: exe,
      save: tmpRCFile,
      action: 'extract',
      mask: 'VERSIONINFO,,'
    })

    // rh.exe -open source.exe -save .\icons -action extract -mask ICONGROUP,, -log CON
    const file1 = (await fs.readFile(tmpRCFile)).toString('utf-8').trim()
    const rcContent = (await fs.readFile(rc)).toString('utf-8').trim()

    // console.log(file1)
    // console.log(rcContent)

    const diff = JsDiff.diffTrimmedLines(file1, rcContent)

    console.log(JSON.stringify(diff, null, 3))
  }

  parseTargets () {
    // [ 'node6-macos-x64', 'node6-linux-x64' ]
    const {
      hostArch,
      hostPlatform,
      isValidNodeRange,
      knownArchs,
      knownPlatforms,
      toFancyArch,
      toFancyPlatform
    } = this.pkgFetch.system
    const hostNodeRange = 'node' + process.version.match(/^v(\d+)/)[1]

    const targets = []
    for (const item of this.unparsedTargets) {
      const target = {
        nodeRange: hostNodeRange,
        platform: hostPlatform,
        arch: hostArch,
        name: item
      }
      if (item !== 'host') {
        for (const token of item.split('-')) {
          if (!token) continue
          if (isValidNodeRange(token)) {
            target.nodeRange = token
            continue
          }
          const p = toFancyPlatform(token)
          if (knownPlatforms.indexOf(p) >= 0) {
            target.platform = p
            continue
          }
          const a = toFancyArch(token)
          if (knownArchs.indexOf(a) >= 0) {
            target.arch = a
            continue
          }
          throw new Error('invalid target: ' + item)
        }
      }
      targets.push({
        name: item,
        target
      })
    }
    this.targets = targets
  }

  static async execRH (path, opts) {
    const possibleOpts = [
      'open',
      'action',
      'save',
      'resource',
      'mask'
    ]

    const args = []

    possibleOpts.forEach(o => {
      if (opts[o]) {
        args.push('-' + o)
        args.push(opts[o])
      }
    })

    return execFileP(path, args)
  }
}

function toCommaVersion (version) {
  const versionRegex = RegExp('([0-9].){3}[0-9]')

  if (versionRegex.test(version)) {
    version = version.replace(/\./g, ',')
  } else {
    version = version.split('-')[0].split('.').join(',') + ',0'
  }

  return version
}

async function waitOnStreamEnd (stream) {
  return new Promise(resolve => stream.on('finish', resolve))
}

async function ensureDir (dirs) {
  const tasks = dirs.map(dir => fs.ensureDir(dir))
  await Promise.all(tasks)
}

function removeNullProperties (obj) {
  Object.keys(obj).filter(k => (obj[k] == null)).forEach(k => delete obj[k])
  return obj
}

async function exec (opts) {
  const metadata = new PKGMetadata(opts)
  await metadata.run()
  return metadata
}

module.exports = {
  PKGMetadata,
  exec
}
