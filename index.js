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

/** Class representing a PKGMetadata instance. */
class PKGMetadata {
  constructor (opts) {
    this.target = opts.target || {}
    this.targetString = ''

    this.nodeVersion = opts.nodeVersion || process.version.slice(1)

    this.resPath = path.join(__dirname, 'res')
    this.cachePath = path.join(__dirname, '.cache')
    this.baseTMPPath = path.join(__dirname, '.tmp')

    // this.tmpPath = path.join(__dirname, '.tmp')
    this.pkgCachePath = path.join(os.homedir(), '.pkg-cache')

    this.metaData = opts.metaData || {}

    this.icon = opts.icon ? path.resolve(opts.icon) : null

    this.rcData = opts.rcData || {}

    this.pkg = opts.pkg

    this.baseBinName = `fetched-v${this.nodeVersion}-win-x64`
    this.baseBinNameTMP = this.baseBinName + '.backup'
    this.baseBinPath = path.join(this.pkgCachePath, 'v2.6', this.baseBinName)

    this.rhURL = 'http://www.angusj.com/resourcehacker/resource_hacker.zip'
    this.rhPath = path.join(this.cachePath, 'rh')
    this.rhPathZip = this.rhPath + '.zip'

    if (opts.rhPath) {
      this.rhCustom = true
      this.rhPathExe = path.resolve(opts.rhPath)
    } else {
      this.rhCustom = false
      this.rhPathExe = path.join(this.rhPath, 'ResourceHacker.exe')
    }

    if (opts.rcFilePath) {
      this.rcCustom = true
      this.rcFilePath = opts.rcFilePath
    } else {
      this.rcCustom = false
    }
  }

  async run () {
    console.log('start...')

    await this.genTMPPaths()

    await ensureDir([
      this.cachePath,
      this.tmpPath,
      this.rhPath
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

    if (this.rhCustom) { return }

    if (!fs.existsSync(this.rhPathZip)) {
      const res = await fetch(this.rhURL)
      const zipOut = fs.createWriteStream(this.rhPathZip)
      res.body.pipe(zipOut)
      await waitOnStreamEnd(zipOut)
    }

    if (!fs.existsSync(this.rhPathExe)) {
      const zipIn = fs.createReadStream(this.rhPathZip)
      const exeOut = unzipper.Extract({ path: this.rhPath })
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
    console.log('generate Res')
    if (!this.rcCustom) {
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

    await this.execRH({
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

    await this.execRH({
      open: this.baseBinPath,
      save: this.baseBinPath,
      action: 'addoverwrite',
      resource: this.resFilePath
    })

    if (this.icon) {
      console.log('change icon')

      await this.execRH({
        open: this.baseBinPath,
        save: this.baseBinPath,
        action: 'addoverwrite',
        resource: this.icon,
        mask: 'ICONGROUP,MAINICON,'
      })
    }
  }

  async execRH (opts) {
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

    return execFileP(this.rhPathExe, args)
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
    await fs.remove(this.tmpPath)
  }

  async genTMPPaths () {
    if (this.tmpPath) { return }
    await fs.ensureDir(this.baseTMPPath)

    let tmpPathName
    let tmpPath
    while (true) {
      tmpPathName = await randString(8, 'hex')
      tmpPath = path.join(this.baseTMPPath, tmpPathName)

      if (fs.existsSync(tmpPath)) {
        continue
      }
      break
    }

    this.tmpPath = tmpPath
    this.baseBinPathTMP = path.join(this.tmpPath, this.baseBinNameTMP)

    if (!this.rcCustom) {
      this.rcFilePath = path.join(this.tmpPath, 'bin.rc')
    }
    this.resFilePath = path.join(this.tmpPath, 'bin.res')
  }
}

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
