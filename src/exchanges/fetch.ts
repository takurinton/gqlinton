import { filter, merge, mergeMap, pipe, share, takeUntil, onPush } from 'wonka';

import { Exchange } from '../types';
// TODO: internal の実装
// import {
//   makeFetchBody,
//   makeFetchURL,
//   makeFetchOptions,
//   makeFetchSource,
// } from '../internal';

// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
// Sends an operation to the API using fetch and adds results to the output stream
// fetch を使用して API に operation 送信して、結果を output stream に追加する
export const fetchExchange: Exchange = ({ forward, dispatchDebug }) => {}