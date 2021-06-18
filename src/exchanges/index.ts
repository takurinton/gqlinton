export { cacheExchange } from './cache';
export { dedupExchange } from './dedup';
export { fetchExchange } from './fetch';
export { composeExchanges } from './compose';

import { cacheExchange } from './cache';
import { dedupExchange } from './dedup';
import { fetchExchange } from './fetch';

// デフォルトの Exchange
// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
export const defaultExchanges = [dedupExchange, cacheExchange, fetchExchange]; 