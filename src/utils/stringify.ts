// https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Set
const seen = new Set();
// cache は WeakMap を使用する(どこかで読んだ)
const cache = new WeakMap();

const _stringify = (x: any): string => {
    if (x === null || seen.has(x)) return 'null';
    else if (typeof x !== 'object') return JSON.stringify(x) || '';
    else if (x.toJson) return _stringify(x.toJson()); // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Date/toJSON
    else if (Array.isArray(x)) { // 配列だったら
        let res = '[';
        for (let i = 0, len = x.length; i < len; i++) {
            if (i > 0) res += ',';
            const value = _stringify(x[i]);
            res += value.length > 0 ? value: 'null';
        }
        
        res += ']';
        return res;
    }

    const keys = Object.keys(x).sort();
    if (!keys.length && x.constructor && x.constructor !== Object) {
        const key = cache.get(x) || Math.random().toString(36).slice(2);
        cache.set(x, key);
        return `{"__key":"${key}"}`;
    }

    seen.add(x);

    let res = '{';
    for (let i = 0, len = keys.length; i < len; i++) {
        const key = keys[i];
        const value = _stringify(x[key]);
        if (value) {
        if (res.length > 1) res += ',';
        res += `${_stringify(key)}:+${value}`;
        };
    };

    seen.delete(x);
    res += '}';
    return res;
};

export const stringify = (x: any): string => {
  seen.clear();
  return _stringify(x);
}