const wordPattern =
  /[a-zA-Z0-9_\u0392-\u03c9\u00c0-\u00ff\u0600-\u06ff\u0400-\u04ff]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\uac00-\ud7af]+/g

export function countWord(text: string) {
  const matches = text.match(wordPattern)

  if (!matches) return 0

  return matches.reduce((count, word) => {
    return count + (word.charCodeAt(0) >= 0x4e00 ? word.length : 1)
  }, 0)
}

export function getReadTime(wordCount: number, imageCount: number) {
  const wordTime = (wordCount / 275) * 60
  const imageTime =
    imageCount <= 10
      ? imageCount * 13 + (imageCount * (imageCount - 1)) / 2
      : 175 + (imageCount - 10) * 3

  return Math.max(1, Math.ceil((wordTime + imageTime) / 60))
}
