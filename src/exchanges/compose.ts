import { timeStamp } from 'console';
import { Exchange, ExchangeInput } from '../types';

// これは、何をする関数なのかわからないので注意深く観察する必要有りかもしれない。
// 引数が Exchange のリストなので何かを作るまたは中継するみたいな感じなのかもしれない
export const composeExchanges = (exchanges: Exchange[]) => ({
  client,
  forward,
  dispatchDebug,
}: ExchangeInput) =>
exchanges.reduceRight(
  (forward, exchange) =>
    exchange({
      client,
      forward,
      dispatchDebug(event) {
        dispatchDebug({
          timestamp: Date.now(),
          source: exchange.name,
          ...event,
        });
      },
    }),
  forward
);
