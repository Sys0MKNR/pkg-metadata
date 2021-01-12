# Info

Used for generating bundleded executables with custom metadata with pkg for windows. 


> Only works on windows.

> \> node 10.x.x 


# usage 


## Basic

```js
const { PKGMetadata } = require('pkg-metadata')

const metadata = new PKGMetadata({
  metaData: {
    version: '1.1.1',
    name: 'bin',
    description: 'this is a custom test desc',
    legal: 'copyright @me',
  },
  icon: '<path-to-icon>',
  pkg: {
    src: '<path-to-entry>',
    out: '<path-to-out-dir'
  }
})

await metaData.run()

```


## function

```js
const { exec } = require('pkg-metadata')

const metadata = await exec({
    // options
})
```


## no pkg with manual cleanup of base binaries


```js
const { PKGMetadata } = require('pkg-metadata')

const metadata = new PKGMetadata({
    // options
    pkg: null
})

await metaData.run()

// run pkg manually

await metaData.cleanup()
```


## with rcData, target and  pkg args 

```js
const { PKGMetadata } = require('pkg-metadata')

const metadata = new PKGMetadata({
  // options
  rcData: {
    FileDescription: 'this is a test desc',
    FileVersion: '1.1.1.2',
    InternalName: 'bin.exe',
    LegalCopyright: 'copyright @me',
    OriginalFilename: 'bin.exe',
    ProductName: 'bin',
    ProductVersion: '1.1.1'
  },
  pkg: {
    args: [
      path.join(__dirname, 'pkgTest.js'),
      '--target',
      'node12.13.1-win',
      '--output',
      'out.exe'
    ]
  },
  targets: [
    'node12.13.1-win'
  ]
})

await metaData.run()
```



# options

## icon [String]

Used to set the exe icon.
Possible path options:  
* .ico file
* png file (256x256)
* a directory with png files for 16x16, 24x24, 32x32, 48x48, 64x64, 128x128 and 256x256. The files have to be named \<dimension>.png (16.png, 256.png, etc)

For the png and directory option missing icons are generated from the biggest provided one. 

## keepTMP [Boolean]

Keep the temporary .tmp folder. 

## metaData [Object]

Metadata for the exe. 

* version
* name
* description
* legal

> Will be overriden if certain rcData values are set. 


## pkg [Object]

Options used for running pkg.

* in

Path to the root file or a package.json.

* out

Filepath where the final exe should be.

* args

Custom pkg args.

> If args is set then in and out are ignored. 

> If pkg is not set then pkg will not be executed. It is also necessary to call PKGMetadata.cleanup() or cleanup() manually because the edited base binary will still be in the pkg cache. 

## pkgCachePath [String]

Path used to cache the base binaries. 

## rcData [Object]

Rc values to directly set.

* FileDescription
* FileVersion
* InternalName
* LegalCopyright
* OriginalFilename
* ProductName
* ProductVersion

> Overrides metaData values. 

> Values other than the shown ones can also be added. Those are just the standard ones.  
 
## rcFilePath [String]

File used to generate the res file for the exe metadata. 

> If this value is set metaData and rcData will be ignored. 


## resFilePath [String]

File used to edit the exe metadata. 

> If this value is set metaData, rcDat and rcFilePath will be ignored. 



## rhPath [String]

The path to the ResourceHacker executable. 

> If set, ResourceHacker won't be downloaded.



## targets [Array]

The targets. 

> Uses the same target strings as [vercel/pkg](https://github.com/vercel/pkg). (e.g: node12-win-x64)

> If empty the hosts nodeversion, platform and arch is used. 



# Rand info

* wip

