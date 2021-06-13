export const typenameWrap = (data: any): any => {
    if (!data || typeof data !== 'object') return data;
    return Object.keys(data).reduce((acc, key: string) => {
      const value = data[key];
      // クエリの名前
      if (key === '__typename') {
        Object.defineProperty(acc, '__typename', {
          enumerable: false,
          value,
        });
      } 
      else if (Array.isArray(value)) acc[key] = value.map(typenameWrap);
      else if (value && typeof value === 'object' && '__typename' in value) acc[key] = typenameWrap(value);
      else acc[key] = value;
      return acc;
    }, {});
};