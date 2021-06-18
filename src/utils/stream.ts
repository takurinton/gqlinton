import { Source, pipe, toPromise, filter, take } from 'wonka';
import { OperationResult, PromisifiedSource } from '../types';

export function stream<T extends OperationResult>(
    source$: Source<T>
  ): PromisifiedSource<T> {
    (source$ as PromisifiedSource<T>).toPromise = () => {
      return pipe(
        source$,
        filter(result => !result.old),
        take(1),
        toPromise
      );
    };

    return source$ as PromisifiedSource<T>;
}