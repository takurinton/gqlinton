import { createClient, gql } from '@urql/core';

const QUERY = gql`
query postQuery($id: Int){
  getPost (id: $id){
    id
    title
    contents
    pub_date
  }
}
`;

const client = createClient({
    url: 'http://localhost:8080/graphql',
});

client.query(QUERY, { id: 50 })
.toPromise()
.then(res => console.log(res))
