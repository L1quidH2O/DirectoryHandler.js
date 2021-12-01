# DirectoryHandler.js
A wrapper for FileSystemDirectoryHandler, allows you to write, read, and manage a local directory from the browser


```js
var dirHandle = new DirectoryHandler();
document.onclick = async function(){
  dirHandle.assignFS(await window.showDirectoryPicker());
}
```

CDN
====
```html
<script src="https://cdn.jsdelivr.net/gh/L1quidH2O/DirectoryHandler.js@latest/DirectoryHandler.min.js"></script>
```

MDN Web Docs
============
[MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle)

Examples
============

mkdir()
--------
*Creates a subdirectory*

```js
await dirHandle.mkdir("folder/nestedfolder")
```

it will also create parent directories that do not exist


cd()
-----
*Change Directory*

```js
await dirHandle.cd("subdirectory")
```

sort()
------
*sorts files in a directory*

sort() accepts wildcards, if the path is left undefined, it will sort all files in the current directory.

```js
await dirHandle.sort("*.js")
```

The second argument of sort() is a sort function, if left undefined it will sort by size from least to greatest

```js
await dirHandle.sort("*.js", function(a, b){
    return a.lastModified - b.lastModified;
})
```

dir
----
*Lists all folders and files in a directory*
```js
await dirHandle.dir();
```

dir() can take a directory as an argument
```js
await dirHandle.dir("subfolder");
```

getDir()
--------
*returns a FileSystemDirectoryHandle*

```js
await dirHandle.getDir("folder/folder")
```

getDir does **not** accept wildcards


getFile()
---------
*returns FileSystemFileHandle*

```js
await dirHandle.getFile("file.txt")
```

getFile() accepts wildcards, and will return FileSystemFileHandle[]

```js
await dirHandle.getFile("*.txt")
```

readFile()
----------
*returns content of file as text*

```js
await dirHandle.readFile("file.txt")
```

readFile() can also slice a file to read only a section

```js
await dirHandle.readFile("file.txt", 10, 30)    //read file from bytes 10 to 30
```

writeFile()
-----------
*overwrites data to file*

```js
await dirHandle.writeFile("file.txt", "nice file")
```

writeFile accepts wildcards

```js
await dirHandle.writeFile("*.txt", "nice file")
```

writeFile can also append to file(s)

```js
await dirHandle.writeFile("*.txt", "nice file", true)   //third argument = append?
```

#### NOTE: do **not** use writeFile() if you want ot constantly append to a file, as it writes to disk every function call and will be slow, instead use appendFileStream()

<br>
appendFileStream()
------------------
*return a `DirectoryHandler.appendFileStream()`*

Same as BufferedWriter() in java

appending to file will fill in a string,
when the string reaches a certain length (default is 8192)
it will flush it all into the temp file.

it only writes to disk on `flush()` and `close()`

`close()` flushes by itself, there is no need to call both flush and close

(does **not** support wildcard)
 
```js
var appendStream = await fs.appendFileStream("file.txt", 8192); //second argument is optional bufferSize
await appendStream.append("nice");
await appendStream.flush();
await appendStream.append("cools");
await appendStream.close();
```

more()
-----
*returns a ReadableStreamDefaultReader for a file*

```js
await dirHandle.more("file.txt")
```

copy()
------
*copies file to a directory or overwrites a target file with file content*

```js
//file to file
await dirHandle.copy("file.txt", "target.txt")

//file to directory
await dirHandle.copy("file.txt", "folder")
```

copy() does **not** support wildcard


tree
----
*returns JSON object representing entire directory*

```js
var tree = await dirHandle.tree();
console.log(tree);
```

```json
{
    "kind": "directory",
    "name": "root:",
    "value": (FileSystemDirectoryHandle),
    "path": "root:",
    "files": [
         {
             "kind": "file",
             "name": "file.txt",
             "value": (FileSystemFileHandle),
             "path": "root:/file.txt",
         },
         {
             "kind": "directory",
             "name": "folder",
             "value": (FileSystemDirectoryHandle),
             "path": "root:/folder",
             "files": [...]
         },
         ...
    ]
}

```

equals()
--------
*returns true if two DirectoryHandlers are refrencing the same root directory*

```js
var dir = await window.showDirectoryPicker()
var dirHandler = new DirectoryHandler(dir)
var dirHandler2 = new DirectoryHandler(dir)

console.log(dirHandler.equals(dirHandler2))    //returns true
```
