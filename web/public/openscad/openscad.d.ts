export interface InitOptions {
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
    locateFile?: (path: string, prefix: string) => string;
    monitorRunDependencies?: (left: number) => void;
    onExit?: (status: number) => void;
    [key: string]: unknown;
}
export interface OpenSCAD {
    callMain(args: Array<string>): number;
    FS: FS;
    locateFile?: (path: string, prefix: string) => string;
}
export interface FS {
    mkdir(path: string): void;
    rename(oldpath: string, newpath: string): void;
    rmdir(path: string): void;
    stat(path: string): unknown;
    readFile(path: string): string | Uint8Array;
    readFile(path: string, opts: {
        encoding: "utf8";
    }): string;
    readFile(path: string, opts: {
        encoding: "binary";
    }): Uint8Array;
    writeFile(path: string, data: string | ArrayBufferView): void;
    unlink(path: string): void;
}
declare function OpenSCAD(options?: InitOptions): Promise<OpenSCAD>;
export declare function getBuildInfo(): Promise<Array<string>>;
export default OpenSCAD;
