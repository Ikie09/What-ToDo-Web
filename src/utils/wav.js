// Builds a 16-bit PCM mono WAV file from chunks of Int16 samples. The chunks are not copied into one
// big array: the Blob just points at them, which keeps a 15-minute recording (~29 MB) cheap.

export function encodeWav(chunks, sampleRate) {
    const samples = chunks.reduce((sum, c) => sum + c.length, 0)
    const dataBytes = samples * 2

    const header = new ArrayBuffer(44)
    const view = new DataView(header)
    const writeText = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }

    writeText(0, 'RIFF')
    view.setUint32(4, 36 + dataBytes, true)
    writeText(8, 'WAVE')
    writeText(12, 'fmt ')
    view.setUint32(16, 16, true)            // PCM header size
    view.setUint16(20, 1, true)             // format: PCM
    view.setUint16(22, 1, true)             // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // bytes per second
    view.setUint16(32, 2, true)             // bytes per frame
    view.setUint16(34, 16, true)            // bits per sample
    writeText(36, 'data')
    view.setUint32(40, dataBytes, true)

    return new Blob([header, ...chunks], { type: 'audio/wav' })
}
