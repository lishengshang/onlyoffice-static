// 最近文件记录（IndexedDB files store 的行结构）
export interface FileRecord {
    id: string
    name: string
    fileType: string
    size: number
    /** 首次保存后才有内容；新建未保存时为 null */
    blob: Blob | null
    updatedAt?: number
}
