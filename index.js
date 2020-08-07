const path = require('path')
const os = require('os')
const util = require('util')
const { exec } = require('child_process')

const execP = util.promisify(exec)

const fetch = require('node-fetch')
const fs = require('fs-extra')
const unzipper = require('unzipper')
const pkgfetch = require('pkg-fetch')
const { exec: pkgExec } = require('pkg')

const pkginfo = require('pkginfo')(module, 'version', 'name', 'description', 'author')

// take info from package.json
// pkg options

class PKGMetadata {
  constructor (opts) {
    this.nodeVersion = opts.nodeVersion || process.version.slice(1)

    this.resPath = path.join(__dirname, 'res')
    this.cachePath = path.join(__dirname, '.cache')
    this.tmpPath = path.join(__dirname, '.tmp')
    this.pkgCachePath = path.join(os.homedir(), '.pkg-cache')
    this.distPath = path.resolve(opts.distPath) || path.join(__dirname, '.dist')

    this.version = opts.version
    this.name = opts.name
    this.description = opts.description
    this.author = opts.author

    this.icon = path.resolve(opts.icon)

    this.rcData = opts.rcData || {}

    this.pkg = opts.pkg || true
    this.pkgOptions = opts.pkgOptions

    this.binPath = path.join(this.distPath, this.name)

    this.baseBinName = `fetched-v${this.nodeVersion}-win-x64`
    this.baseBinNameTMP = this.baseBinName + '.backup'
    this.baseBinPath = path.join(this.pkgCachePath, 'v2.6', this.baseBinName)
    this.baseBinPathTMP = path.join(this.tmpPath, this.baseBinNameTMP)

    this.rhURL = 'http://www.angusj.com/resourcehacker/resource_hacker.zip'
    this.rhPath = path.join(this.cachePath, 'rh')
    this.rhPathZip = this.rhPath + '.zip'
    this.rhPathExe = path.join(this.rhPath, 'ResourceHacker.exe')

    this.rcName = 'bin.rc'
    this.resName = 'bin.res'
    this.rcPath = path.join(this.tmpPath, this.rcName)
    this.resFilePath = path.join(this.tmpPath, this.resName)
  }

  async run () {
    await ensureDir([
      this.cachePath,
      this.tmpPath,
      this.rhPath,
      this.distPath
    ])

    await this.fetchResourceHacker()
    await this.fetchBinaries()
    await this.generateRES()
    await this.editMetaData()

    if (this.pkg) {
      await this.runPKG()
      await this.cleanup()
    }
    // await this.cleanup()
  }

  async fetchResourceHacker () {
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
    console.log(this.baseBinPath)
    if (!fs.existsSync(this.baseBinPath)) {
      await pkgfetch.need({ nodeRange: `node${this.nodeVersion}`, platform: 'win', arch: 'x64' })
    }
  }

  async generateRES () {
    let rcSample = await fs.readFile(path.join(this.resPath, 'q_sample.rc'))
    rcSample = rcSample.toString()

    let rc = rcSample.replace('#fileVersion#', toCommaVersion(this.rcData.FileVersion))
    rc = rc.replace('#productVersion#', toCommaVersion(this.rcData.ProductVersion))

    let block = ''

    console.log(this.rcData)

    for (const [key, value] of Object.entries(this.rcData)) {
      block += `\t\tVALUE "${key}", "${value}"\n`
    }

    rc = rc.replace('#fileInfoBlock#', block)

    await fs.writeFile(this.rcPath, rc)

    await execP(`${this.rhPathExe} -open ${this.rcPath} -action compile -save ${this.resFilePath}`)
  }

  async editMetaData () {
    // copy to temp

    console.log('lul')

    console.log(this.baseBinPath)

    if (!fs.existsSync(this.baseBinPath)) { throw new Error() }
    await fs.copyFile(this.baseBinPath, this.baseBinPathTMP)

    // edit metadata
    await execP(`${this.rhPathExe} -open ${this.baseBinPath} -resource ${this.resFilePath} -action addoverwrite  -save ${this.baseBinPath}`)

    if (this.icon) {
      await execP(`${this.rhPathExe} -open ${this.baseBinPath} -resource ${this.icon} -action addoverwrite -mask ICONGROUP,MAINICON, -save ${this.baseBinPath}`)
    }
  }

  async runPKG () {
    await pkgExec(this.pkgOptions)
  }

  async cleanup () {
    console.log('cleanup')
    await fs.copyFile(this.baseBinPathTMP, this.baseBinPath)
  }
}

function toCommaVersion (version) {
  const versionRegex = RegExp('([0-9]\.){3}[0-9]')

  if (versionRegex.test(version)) {
    version = version.replace(/\./g, ',')
  } else {
    version = version.split('-')[0].split('.').join(',') + ',0'
  }

  console.log(version)

  return version
}

// function padVersion (version) {
//   return version.split('-')[0].split('.').join(',') + ',0'
// }

async function waitOnStreamEnd (stream) {
  return new Promise(resolve => stream.on('finish', resolve))
}

async function ensureDir (dirs) {
  const tasks = dirs.map(dir => fs.ensureDir(dir))
  await Promise.all(tasks)
}

module.exports = PKGMetadata
