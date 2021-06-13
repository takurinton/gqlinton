import { Operation, OperationResult } from '../types';
import { CombinedError } from './error';

// エラーを生成
export const makeOkResult = (
    operation: Operation,
    result: any,
    response?: any
): OperationResult => ({
    operation, 
    data: Array.isArray(result.errors) ? new CombinedError({
        graphQLErrors: result.errors, 
        response
    }) : undefined, 
    extensions: (typeof result.extensions === 'object' && result.extensions) || undefined
});

// エラー
export const makeErrorResult = (
    operation: Operation,
    error: Error,
    response?: any
): OperationResult => ({
    operation,
    data: undefined,
    error: new CombinedError({
      networkError: error,
      response,
    }),
    extensions: undefined,
});
    