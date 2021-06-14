import {
    filter,
    make,
    makeSubject,
    onEnd,
    onPush,
    onStart,
    pipe,
    share,
    Source,
    take,
    takeUntil,
    publish,
    subscribe,
    switchMap,
    fromValue,
    merge,
    map,
    Subscription,
} from 'wonka';

import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';

import { composeExchanges, defaultExchanges } from './exchanges';
import { fallbackExchange } from './exchanges/fallback';

import {
    Exchange,
    ExchangeInput,
    GraphQLRequest,
    Operation,
    OperationContext,
    OperationResult,
    OperationType,
    RequestPolicy,
    PromisifiedSource,
    DebugEvent,
} from './types';

import {
    createRequest,
    stream,
    typenameWrap,
    noop,
    makeOperation, 
} from './utils';

export interface Client {
    reexecuteOperation: (operation: Operation) => void;
};