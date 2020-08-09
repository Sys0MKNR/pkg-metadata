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


## icon [String]

Path to the icon. 


## metaData [Object]

Metadata for the exe. 

* version
* name
* description
* legal

> Will be overriden if certain rcData values are set. 


## rcFilePath [String]

File used to generate the exe metadata. 

> If this value is set metaData and rcDat will be ignored. 


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



# Rand info

* wip
* icons are pretty scuffed. The old ones are still in the exe and only the mainicon is set to the new one. 