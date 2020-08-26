const path = require('path')
const os = require('os')
const util = require('util')
const crypto = require('crypto')

const { execFile } = require('child_process')

const execFileP = util.promisify(execFile)
const randomBytes = util.promisify(crypto.randomBytes)

const fetch = require('node-fetch')
const fs = require('fs-extra')
const unzipper = require('unzipper')
const pkgfetch = require('pkg-fetch')
const { exec: pkgExec } = require('pkg')

const JsDiff = require('diff')
const sizeOf = require('image-size')
const sharp = require('sharp')
const icongen = require('icon-gen')

const TMP_PATH = path.join(__dirname, '.tmp')
const CACHE_PATH = path.join(__dirname, '.cache')
const RES_PATH = path.join(__dirname, 'res')

const PKG_CACHE_PATH = path.join(os.homedir(), '.pkg-cache')

const RH_URL = 'http://www.angusj.com/resourcehacker/resource_hacker.zip'

/** Class representing a PKGMetadata instance. */
class PKGMetadata {
  constructor (opts) {
    this.keepTMP = opts.keepTMP
    this.nodeVersion = opts.nodeVersion || process.version.slice(1)

    this.tmpPath = TMP_PATH
    this.cachePath = CACHE_PATH
    this.resPath = RES_PATH
    this.pkgCachePath = PKG_CACHE_PATH

    this.metaData = opts.metaData || {}
    this.icon = opts.icon ? path.resolve(opts.icon) : null
    this.rcData = opts.rcData || {}

    this.pkg = opts.pkg

    this.baseBinName = `fetched-v${this.nodeVersion}-win-x64`
    this.baseBinNameTMP = this.baseBinName + '.backup'
    this.baseBinPath = path.join(this.pkgCachePath, 'v2.6', this.baseBinName)
    this.baseBinPathTMP = path.join(this.tmpPath, this.baseBinNameTMP)

    this.rhPath = opts.rhPath

    this.rcFilePath = opts.rcFilePath
    this.resFilePath = opts.resFilePath
  }

  async run () {
    console.log('start...')

    await ensureDir([
      this.cachePath,
      this.tmpPath
    ])

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
    console.log('fetch ResourceHacker')
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
      const exeOut = unzipper.Extract({ path: rhPathDir })
      zipIn.pipe(exeOut)
      await waitOnStreamEnd(exeOut)
    }
  }

  async fetchBinaries () {
    console.log('fetch base binaries')
    if (!fs.existsSync(this.baseBinPath)) {
      await pkgfetch.need({ nodeRange: `node${this.nodeVersion}`, platform: 'win', arch: 'x64' })
    }
  }

  generateRCData () {
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

    return { ...removeNullProperties(customData), ...removeNullProperties(this.rcData) }
  }

  async generateRES () {
    if (this.resFilePath) { return }

    this.resFilePath = path.join(this.tmpPath, 'bin.res')

    console.log('generate Res')
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
    console.log('edit metadata')
    // copy to temp

    if (!fs.existsSync(this.baseBinPath)) { throw new Error() }
    await fs.copyFile(this.baseBinPath, this.baseBinPathTMP)

    // edit metadata

    await this.execRHInternal({
      open: this.baseBinPath,
      save: this.baseBinPath,
      action: 'addoverwrite',
      resource: this.resFilePath
    })

    if (this.icon) {
      console.log('change icon')

      const iconType = this.icon.split('.').pop()
      if (iconType === 'ico') {
        this.finalIcon = this.icon
      } else {
        await this.editIcon()
      }

      // await this.execRHInternal({
      //   open: this.baseBinPath,
      //   save: this.baseBinPath,
      //   action: 'delete',
      //   // resource: this.finalIcon,
      //   mask: 'ICONGROUP,1,'
      // })

      // await this.execRHInternal({
      //   open: this.baseBinPath,
      //   save: this.baseBinPath,
      //   action: 'addoverwrite',
      //   resource: this.finalIcon,
      //   mask: 'ICONGROUP,MAINICON,'
      // })

      await this.execRHInternal({
        open: this.baseBinPath,
        save: this.baseBinPath,
        action: 'addoverwrite',
        resource: this.finalIcon,
        mask: 'ICONGROUP,1,'
      })

      // await this.execRHInternal({
      //   open: this.baseBinPath,
      //   save: this.baseBinPath,
      //   action: 'delete',
      //   // resource: this.finalIcon,
      //   mask: 'ICON,,'
      // })
    }
  }

  async editIcon () {
    console.log('edit icon')
    if (!this.icon) { return }

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

    this.finalIcon = path.join(tmpIconFinalPath, 'icon.ico')

    await icongen(tmpIconRawPath, tmpIconFinalPath, {
      report: true,
      ico: { name: 'icon' }
    })
  }

  async runPKG () {
    console.log('run pkg')

    let args = this.pkg.args

    if (!args) {
      args = [
        this.pkg.src,
        '--target',
        `node${this.nodeVersion}-win`,
        '--output',
        this.pkg.out
      ]
    }

    await pkgExec(args)
  }

  async cleanup () {
    console.log('cleanup')
    await fs.copyFile(this.baseBinPathTMP, this.baseBinPath)

    if (!this.keepTMP) { await fs.remove(this.tmpPath) }
  }

  async execRHInternal (opts) {
    return PKGMetadata.execRH(this.rhPath, opts)
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

// static async compareExeWithRC (exe, rc) {
// const tmpPath = path.join(__dirname, '.tmp')
// const tmpRCFile = path.join(tmpPath, 'exeRc.rc')

// await fs.ensureDir(tmpPath)

// await PKGMetadata.execRH({
//   open: exe,
//   save: tmpRCFile,
//   action: 'extract',
//   mask: 'VERSIONINFO,,'
// })

// // rh.exe -open source.exe -save .\icons -action extract -mask ICONGROUP,, -log CON
// const file1 = await fs.readFile(tmpRCFile).toString('utf-8').trim()
// const rcContent = await fs.readFile(rc).toString('utf-8').trim()
// const diff = JsDiff.diffTrimmedLines(file1, rcContent)

// console.log(diff)
// }

function toCommaVersion (version) {
  const versionRegex = RegExp('([0-9]\.){3}[0-9]')

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

async function randString (length, encoding) {
  const bytes = await randomBytes(length)
  return encoding ? bytes.toString(encoding) : bytes.toString()
}

module.exports = { PKGMetadata, exec }
