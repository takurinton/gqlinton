import { filter, pipe, tap } from 'wonka';
import { Exchange, Operation, OperationResult } from '../types';

// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
// Deduplicates pending operations (pending = waiting for a result)
// 保留中の操作を重複させます（保留中=結果を待機中）
export const dedupExchange: Exchange = ({ forward, dispatchDebug }) => {
    const inFlightKeys = new Set<number>();

    // この画像の処理（多分）
    // https://formidable.com/open-source/urql/static/urql-event-hub.1106f5ab.png
    const filterIncomingOperation = (operation: Operation) => {
        const { key, kind } = operation;

        if (kind === 'teardown') {
            inFlightKeys.delete(key);
            return true;
        }

        if (kind !== 'query' && kind !== 'subscription') {
            return true;
        }

        // ここまで処理が来たら Mutation って認識でいいのかな
        // キーがあるかないか関係なく加えるのか
        const isInFlight = inFlightKeys.has(key);
        inFlightKeys.add(key);

        if (isInFlight) {
            dispatchDebug({
              type: 'dedup',
              message: 'An operation has been deduped.',
              operation,
            });
        }

        // どうして逆を返してるんだ
        return !isInFlight;
    }

    // operation の結果を返す
    const afterOperationResult = ({ operation }: OperationResult) => {
        inFlightKeys.delete(operation.key);
    };

    // ここは何を返してるのかいまいちわからない
    return ops$ => {
        const forward$ = pipe(ops$, filter(filterIncomingOperation));
        return pipe(forward(forward$), tap(afterOperationResult));
    };
    
}