import { filter, map, merge, pipe, share, tap } from 'wonka';

import { Client } from '../client';
import { Exchange, Operation, OperationResult } from '../types';

import {
  makeOperation,
  addMetadata,
  collectTypesFromResponse,
  Doc2String,
} from '../utils';

type ResultCache = Map<number, OperationResult>;

interface OperationCache {
  [key: string]: Set<number>;
}

// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
// The default caching logic with "Document Caching"
// デフォルトのキャッシュロジックを実装してる、ドキュメントキャッシングという仕組み
// キャッシュがあればそいつを返す、なければリクエストを投げる
export const cacheExchange: Exchange = () => {};