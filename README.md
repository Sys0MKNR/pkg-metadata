# usage 


## Basic

```js
const { PKGMetadata } = require('pkg-metadata')

const metadata = new PKGMetadata({
  nodeVersion: '12.13.1',
  metaData: {
    version: '1.1.1',
    name: 'bin',
    description: 'this is a custom test desc',
    legal: 'copyright @me',
  },
  icon: '<path-to-icon>',
  pkg: {
    src: '<path-to-entry>',
    out: '<path-to-out-exe>'
  }
})
```


## function

```js
const { exec } = require('pkg-metadata')

const metadata = exec({
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

// run pkg manually

metaData.cleanup()
```


## with rcData and pkg args 

```js
const { PKGMetadata } = require('pkg-metadata')

const metadata = new PKGMetadata({
  nodeVersion: '12.13.1',
  icon: '<path-to-icon>',
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
      '<path-to-entry>',
      '--target',
      `node${'12.13.1'}-win`,
      '--output',
      '<path-to-out-exe>'
    ]
  }
})
```



# options


## nodeVersion [String]

Which node version should be used for pkg. 

## arch [String]

The node binary architecture. x64 or x86. Defaults to x64.


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


## rcFilePath [String]

File used to generate the res file for the exe metadata. 

> If this value is set metaData and rcDat will be ignored. 


## resFilePath [String]

File used to edit the exe metadata. 

> If this value is set metaData, rcDat and rcFilePath will be ignored. 

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


## rhPath

The path to the ResourceHacker executable. 

> If set, ResourceHacker won't be downloaded.


# Rand info

* wip
* nodeVersion and the pkg target version have to be an exact match. Otherwise pkg may use a wrong node base binary. 
* if the base node binary gets corrupted just delete the \<home_dir\>/.pkg-cache folder