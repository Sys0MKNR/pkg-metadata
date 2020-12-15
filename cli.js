const { program } = require('commander')
const pkginfo = require('pkginfo')(module, 'version')

program
  .version(module.exports.version)

program.parse(process.argv)
