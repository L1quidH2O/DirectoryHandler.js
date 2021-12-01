class DirectoryHandler {
    fs;
    rootDir = "fs:";
    currentDirectory = this.rootDir;
    currentDirectoryHandle;

    /**
     * @param {FileSystemDirectoryHandle|undefined} FSDirectoryHandle optional. You can use FileSystem.assignFS(..) instead
    */
    constructor(FSDirectoryHandle) {
        if (FSDirectoryHandle instanceof FileSystemDirectoryHandle) {
            this.fs = FileSystemDirectoryHandle;
        }
    }

    /**
     * Assigns FSDirectoryHandle
     * @param {FileSystemDirectoryHandle} FSDirectoryHandle
    **/
    assignFS(FSDirectoryHandle) {
        this.fs = FSDirectoryHandle;
        this.rootDir = FSDirectoryHandle.name + ":";    // special character ":" so if a file in the root folder with the same name as the root folder wont cause problems
        this.currentDirectory = this.rootDir;
        this.currentDirectoryHandle = FSDirectoryHandle;
    }
    
    /**
     * Make directory/nested directories, will return a DirectoryHandle regardless if the directory already exists or not.
     * 
     * @param {String} directory 
     * @returns {FileSystemDirectoryHandle}
    **/
    mkdir(directory){
        return this.getDir(directory, true);
    }

    /**
     * Change Directory or return current directory handle
     * @param {String|undefined} directory optional.
     * @returns {FileSystemHandles} if directory is falsy, it will return the current directory handle
    */
    cd(directory) {
        if(!directory){
            return this.currentDirectoryHandle;
        }

        return new Promise((resolve, reject) => {
            directory = this.fixDir(directory);

            this.getDir(directory).then(dir=>{
                this.currentDirectoryHandle = dir;
                this.currentDirectory = directory;

                resolve(this.currentDirectoryHandle);
            })
            .catch(reject)
        })
    }

    /**
     * return sorted files in a directory, can use wildcards and custom sort function.
     * default sort function is least to greatest file size
     * 
     * @param {String|Array} filesDirectory a wildcard directory or an array with directories (can include wildcards too)
     * @param {Function|undefined} sortFunction optional. function to use for sorting the files, default is sorting from least to greatest file size
     * @returns {File[]} sorted array of Files
    **/
    sort(filesDirectory, sortFunction){
        sortFunction ??= (a, b)=>(a.size - b.size);
        if(typeof filesDirectory === "string" || !filesDirectory){filesDirectory = [filesDirectory ?? "*"]}
        
        return new Promise(async (resolve, reject) => {
            var f = [], error;
            for(var i = 0; i < filesDirectory.length; i ++){
                var k = await this.getFile(filesDirectory[i]).catch(e=>(error = e))
                if(error){reject(error); return;}
                
                if(k instanceof FileSystemFileHandle){
                    f.push(await k.getFile().catch(e=>(error = e)));
                    if(error){reject(error); return;}
                }
                else{
                    for(var l = 0; l < k.length; l ++){
                        f.push(await k[l].getFile().catch(e=>(error = e)));
                        if(error){reject(error); return;}
                    }
                }
            }
            resolve(f.sort(sortFunction));
        })
    }

    /**
     * Lists all files and folders in directory
     * 
     * @param {String|undefined} directory optional. run function at different directory
     * @returns {FileSystemHandles[]} Array of FileSystemHandles
    **/
    dir(directory){
        return new Promise(async (resolve, reject) => {
            directory = directory ? this.fixDir(directory).split("/") : [".", ""];
            var wildcard = directory.pop(), WC = wildcard.includes("*"), error;
            if(wildcard === this.rootDir){wildcard = ""}
            directory = await this.getDir(directory.join("/") + (WC ? "" : "/" + wildcard)).catch(e=>(error = e));
                                                                //has wildcard ? parent directory : full directory
            
            if(error){reject(error); return;}
            /*
                directory = folder/folder/*.js
                wildcard = *.js
                directory = this.getDir(folder/folder)
                ----------------------------------
                directory = *.js
                wildcard = *.js
                directory = this.getDir('') -> this.currentDirectoryHandle
                ----------------------------------
                directory = folder/folder/folder
                wildcard = folder (not wildcard)
                directory = this.getDir(folder/folder/folder)
            */

            var iterator = directory.values(), arr = [];
            
            for(var v; (v = await iterator.next())?.value !== undefined; ){
                if(WC){
                    if(DirectoryHandler.wildCard(v.value.name, wildcard)){
                        arr.push(v.value)
                    }
                }
                else{
                    arr.push(v.value)
                }
            }

            resolve(arr);
        })
    }

    /**
     * Fixes directory to start from root folder, and fixes some other things
     * 
     * `C:/Users\Me\Documents/../Documents\./folder` becomes `C:/Users/Me/Documents/folder`
     * 
     * @param {String} directory 
     * @returns {String} Directory starting from root folder
    **/
    fixDir(directory) {
        directory = directory.replaceAll("\\", "/");
        var d = directory.split("/");
        var fixedDir;

        if(directory === this.rootDir){
            fixedDir = directory + "/";
        }

        //starts with this.rootPath
        else if (d[0] === this.rootDir){fixedDir = directory;}

        //starts with /
        else if (directory[0] === "/"){fixedDir = this.rootDir + directory;}

        //go back one folder
        else if(d[0] === ".."){
            let t = this.currentDirectory.split("/"); t.pop(); t = t.join("/");
            fixedDir = t + (d[0] === ".." ? directory.substring(2) || "/": directory);
        }

        //same directory (starts with ./ or with folder name)
        else if (d[0] === "." || directory[0] !== "/"){
            fixedDir = this.currentDirectory + (d[0] === "." ? directory.substring(1) : "/" + directory);
        }

        fixedDir = fixedDir.split("/");
        for(var i = 1; i < fixedDir.length; i ++){
            switch(fixedDir[i]){
                case "..":
                    fixedDir.splice(i - 1, 2);
                break;
                case ".":
                case "":
                    fixedDir.splice(i, 1);
                break;
            }
        }

        return fixedDir.join("/");
    }

    /**
     * Get directory, rejects promise of directory is not found
     * 
     * @param {String} directory 
     * @param {Boolean|undefined} create optional. if true, function will create directories if they dont exist
     * @returns {FileSystemDirectoryHandle}
    **/
    getDir(directory, create){
        return new Promise(async (resolve, reject)=>{
            directory = this.fixDir(directory);
            
            if(directory === this.rootDir + "/"){resolve(this.fs); return;}

            var dir = directory.split("/"), pos = this.fs;
            for(var i = 1; i < dir.length; i ++){
                try{
                    pos = await pos.getDirectoryHandle(dir[i], {create: create});
                }
                catch(e){
                    reject(e);
                    break;
                }
            }

            resolve(pos);
        })
    }

    /**
     * Get file/files in directory, supports wildcards.
     * rejects promise if directory is not found
     * 
     * @param {String} directory Supports wildcards
     * @param {Boolean|undefined} create optional. if true, function will create directories and the file if they dont exist
     * @returns {FileSystemFileHandle|FileSystemFileHandle[]} a FileHandle or an Array of files that match the wildcard
    **/
    getFile(directory, create){
        return new Promise(async (resolve, reject) => {
            directory = this.fixDir(directory).split("/");
            var fileName = directory.pop();
            directory = directory.join("/");
            var dir = await this.getDir(directory, create);
            try{
                //wild card, return Array of matching files
                if(fileName.includes("*")){
                    let d = await this.dir(directory), files = [];

                    for(var i = 0; i < d.length; i ++){
                        if(d[i].kind === "file" && DirectoryHandler.wildCard(d[i].name, fileName)){
                            files.push(d[i])
                        }
                    }
                    resolve(files);
                }
                else{   //return Array of one file
                    resolve(await dir.getFileHandle(fileName, {create: create}));
                }
            }
            catch(e){reject(e);}
        })
    }

    /**
     * Reads file as text (does not support wildcard)
     * @param {String} directory directory of file
     * @param {Number|undefined} from optional. where to start reading from
     * @param {Number|undefined} to optional. where to stop reading
     * @returns {String} file text
    **/
    readFile(directory, from, to){
        return new Promise(async (resolve, reject) =>{
            if(directory.includes("*")){
                reject("readFile() does not support wildcards"); return;
            }

            var file = (await (await this.getFile(directory)).getFile()).slice(from, to),   //get file handle -> get File -> slice bytes
                reader = await file.stream().getReader(),
                text = "";
            
            for(var r; (r = await reader.read())?.value !== undefined;){
                let len = r.value.length;
                for(var i = 0; i < len; i ++){
                    text += String.fromCharCode(r.value[i]);
                }
            }

            resolve(text);
        })
    }

    /**
     * Write or Append to file or files (supports wildcard) (will create file if it does not exist)
     * NOTE: do not use this if you want to constantly append to file,
     * as it flushes to disk every time you call the function.
     * To properly constantly append to file use
     * ```
     * new this.appendFileStream("file directory")
     * ```
     * 
     * @param {String} directory 
     * @param {String} content text to write to file
     * @param {Boolean} append if true, it will append to end of file
     * @returns {void}
    **/
    writeFile(directory, content, append){
        return new Promise(async (resolve, reject) => {
            var error;
            var file = directory instanceof FileSystemFileHandle ? directory : await this.getFile(directory, true).catch(e=>(error = e));
            if(error){reject(error); return;}
            try{
                if(file instanceof FileSystemFileHandle){
                    var writable = await file.createWritable({keepExistingData: append});
                    if(append){ await writable.seek((await file.getFile()).size) }
                    await writable.write(content);
                    await writable.close();
                }
                else{
                    for(var i = 0; i < file.length; i ++){
                        var writable = await file[i].createWritable({keepExistingData: append});
                        if(append){ await writable.seek((await file[i].getFile()).size) }
                        await writable.write(content);
                        await writable.close();
                    }
                }
            }
            catch(e){
                reject(e);
            }

            resolve();
        })
    }

    /**
     * Same as BufferedWriter() in java
     * appending to file will fill in a string,
     * when the string reaches a certain length (default is 8192)
     * it will flush it all into the temp file.
     * 
     * it only writes to disk on `flush()` and `close()`
     * 
     * `close()` flushes by itself, there is no need to call both flush and close
     * 
     * (does NOT support wildcard)
     *  
     * ```
     * var appendStream = await dirHandle.appendFileStream(String directory, bufferSize = 8192);
     * await appendStream.append("nice");
     * await appendStream.close();
     * ```
     *
     * 
     * @param {String} directory
     * @param {Number|undefined} bufferSize the max size for the string, default is 8192
     *  
    **/
    async appendFileStream(directory, bufferSize){
        return new DirectoryHandler.appendFileStream(await this.getFile(directory, bufferSize));
    }

    /**
     * Returns a readable stream for a file  (does NOT support wildcard)
     * 
     * @param {String} directory directory of file
     * @returns {ReadableStreamDefaultReader} A readable stream for the file
    **/
    more(directory){
        return new Promise(async (resolve, reject) => {
            if(directory.includes("*")){
                reject("more() does not support wildcards"); return;
            }

            //this.getFile(directory).getFile().stream().getReader()
            this.getFile(directory)
                .then(e=>e.getFile())
                .then(e=>e.stream())
                .then(e=>e.getReader())
                .then(e=>resolve(e))
                .catch(e=>reject(e));

        })
    }

    /**
     * copies a file to a directory or file. if copied to a file, the destination file is overwritten with the files data
     * unfortunatly directories cannot be copied
     * 
     * (does NOT support wildcard)
     * 
     * @param {String} directory file directory that you want to move (folders are cannot be moved)
     * @param {String} destination folder or file you want to move the file to
     * @returns {undefined}
    **/
    copy(directory, destination){
        return new Promise(async (resolve, reject) => {
            var error;
            var file = await this.getFile(directory).catch(e=>(error = e));
            if(error){reject(error); return;}

            var to = await this.getDir(destination)                      //to a directory
                           .catch(()=>this.getFile(destination, true).catch(e=>(error = e)))   //to a File

            if(error){reject(error); return;}

            if(to instanceof FileSystemFileHandle){
                this.writeFile(to, await (await file.getFile()).arrayBuffer(), false).catch(e=>reject(e));
            }
            else{
                this.writeFile(this.fixDir(destination) + "/" + file.name, await (await file.getFile()).arrayBuffer()).catch(e=>reject(e));
            }
            
            resolve();
            
        })
    }

    /**
     * Get a json object of the entire filesystem
     * 
     * (does NOT support wildcard)
     * 
     * Note: `JSON.stringify(tree())` is valid
     * 
     * format:
     * ```json
     * {
     *     "kind": "directory",
     *     "name": "root:",
     *     "value": (FileSystemDirectoryHandle),
     *     "path": "root:",
     *     "files": [
     *          {
     *              "kind": "file",
     *              "name": "file.txt",
     *              "value": (FileSystemFileHandle),
     *              "path": "root:/file.txt",
     *          },
     *          {
     *              "kind": "directory",
     *              "name": "folder",
     *              "value": (FileSystemDirectoryHandle),
     *              "path": "root:/folder",
     *              "files": [...]
     *          },
     *          ...
     *     ]
     * }
     * ```
     * 
     * @param {String|undefined} directory directory of tree
     * @returns {Object} a json object representing the filesystem
    **/
    tree(directory = "."){
        return new Promise(async (resolve, reject) => {
            directory = this.fixDir(directory);
            var error;
            var dir = await this.getDir(directory).catch(e=>(error = e));
            if(error){reject(error); return;}

            var tree = {
                "kind": dir.kind,
                "name": dir.name,
                "value": dir,
                "path": directory,
                "files": []
            };

            var scope = this;

            async function getFiles(dir){
                var d = await scope.dir(dir.path).catch(e=>(error = e));

                if(error){reject(error); return;}
                
                for(var i = 0; i < d.length; i ++){
                    dir.files[i] = {
                        "kind": d[i].kind,
                        "name": d[i].name,
                        "value": d[i],
                        "path": dir.path + "/" + d[i].name
                    };

                    if(d[i] instanceof FileSystemDirectoryHandle){ 
                        dir.files[i].files = [];
                        await getFiles(dir.files[i]); 
                    }
                }
            }

            await getFiles(tree);

            resolve(tree);
        })
    }

    toString(){
        return this.currentDirectory
    }

    /**
     * Check if `this` root directory is refrencing the same directory as `directoryHandler` root directory
     * 
     * @param {DirectoryHandler} directoryHandler 
     * @returns {Boolean} Promise that resolves with boolean
    **/
    equals(directoryHandler){
        return this.fs.fs.isSameEntry(directoryHandler.fs);
    }

    /**
     * Tests if string matches wildcard
     * 
     * @param {String} string String to test on wildcard
     * @param {String} wildcard 
     * @returns {Boolean}
    **/
    static wildCard(string, wildcard){
        if(string === undefined || wildcard === undefined){throw new TypeError("string and wildcard must be a String")}
        //https://stackoverflow.com/a/32402438
        return new RegExp("^" + wildcard.split("*").map(DirectoryHandler.wildCard.escapeRegex).join(".*") + "$").test(string);
    }
    
}

DirectoryHandler.wildCard.escapeRegex = str=>str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
DirectoryHandler.appendFileStream = class{
    buffer = "";
    #initiated = false;
    constructor(fileHandle, bufferSize = 8192){
        this.fileHandle = fileHandle;
        this.bufferSize = bufferSize;
    }

    async #init(){
        if(this.#initiated){return;}

        this.writableStream = await this.fileHandle.createWritable({keepExistingData: true});
        this.writableStream.seek((await (await this.fileHandle).getFile()).size)    //puts cursor at end of file
        this.#initiated = true;
    }

    async append(string){
        this.buffer += string;
        if(this.buffer.length >= this.bufferSize){ await this.flush(); } //8192 taken from javas BufferedWriter() default buffer length
    }

    async flush(){
        if(!this.#initiated){await this.#init()}
        await this.writableStream.write(this.buffer);
        this.buffer = "";
    }

    async close(){
        if(!this.#initiated){await this.#init()}
        await this.writableStream.close();
    }        
}