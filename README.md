# gqlinton

## What

GraphQL client created with reference to [urql](https://github.com/FormidableLabs/urql).   
urql is a great library with a great cache ecosystem, with a minimal and simple structure.   
I referred to this for studying. Great, thank you.   


## Setup

First, fork and build gqlinton.  

```bash
git clone https://github.com/takurinton/gqlinton
cd gqlinton
npm i
npm run build
```

Next, go to the playground and build the example app.

```bash
cd playground/example
npm i 
npm run build
```

Open index.html

```bash
open index.html
```

## Usage

Create the client as follows. Use createClient.  

```ts
import { createClient } from 'gqlinton/dist';

const client = createClient({
    url: 'http:/localhost:8080//graphql',
});
```

The query is defined as follows. Use the gql tag.  

```ts
import { gql } from 'gqlinton/dist';

const QUERY = gql`
query postQuery($pages: Int, $category: String){
  getPosts (page: $pages, category: $category){
    current
    next
    previous
    category
    results {
      id
      title
      contents
      category
      pub_date
    }
  }
}
`;
```

To request a query.

```ts
client
.query(QUERY, { page: 1, category: '' })
.toPromise()
.then(res => console.log(res));
```


## Library used

- [@graphql-typed-document-node/core](https://github.com/dotansimha/graphql-typed-document-node)
- [wonka](https://github.com/kitten/wonka)
- [esbuild](https://github.com/evanw/esbuild)

## Supplement

- I won't publish it to npm
    - because it's for study and is heavily influenced by urql
    - However, now that I have an overview of urql, I am interested in contributing
- It was fun to get a lot of knowledge at the stage of making this
- This is still unfinished