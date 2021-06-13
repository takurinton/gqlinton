// djb2 hash
// http://www.cse.yorku.ca/~oz/hash.html
export const phash = (h: number, x: string): number => {
  h = h | 0;
  for (let i = 0, l = x.length | 0; i < l; i++) {
    // charCodeAt(i) 指定された位置にある UTF-16 コードユニットを表す 0 から 65535 までの整数を返します。
    // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt
    h = (h << 5) + h + x.charCodeAt(i);
  }

  return h;
}

export const hash = (x: string): number => phash(5381 | 0, x) >>> 0;