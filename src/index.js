require('dotenv').config();
const express = require('express');
const app = express();
const { ApolloServer, gql } = require('apollo-server-express');
const neo4j = require('neo4j-driver').v1;
const { makeAugmentedSchema } = require('neo4j-graphql-js');
const { typeDefs } = require('./graphql-schema');

const schema = makeAugmentedSchema({
  typeDefs,
  config: {
    query: {
      exclude: ['RatingCount'],
    },
    mutation: {
      exclude: ['RatingCount'],
    },
  },
});

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'neo4j'
  ),
  {
    encrypted: process.env.NEO4J_ENCRYPTED ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
  }
);

const initializeDatabase = async (driver) => {
  const initCypher = `CALL apoc.schema.assert({}, {User: ["userId"], Business: ["businessId"], Review: ["reviewId"], Series: ["seriesId"], Content: ["contentId"], Event: ["eventId"], Venue: ["venueId"], BusinessCategory: ["name"]})`;
  const ReviewableQuery = `CALL db.index.fulltext.createNodeIndex("Reviewable", ["Ownable"],["userId", "businessId", "reviewId", "seriesId", "contentId", "eventId", "venueId"])`;

  const session = driver.session();
  try {
    await session.writeTransaction((tx) => tx.run(initCypher));
    await session.run(ReviewableQuery);
  } catch (error) {
    console.error(
      'Database initialization failed to complete\n',
      error.message
    );
  } finally {
    session.close();
  }
};

const init = async (driver) => {
  await initializeDatabase(driver);
};

const startServer = async () => {
  init(driver);

  const server = new ApolloServer({
    context: { driver, neo4jDatabase: process.env.NEO4J_DATABASE },
    schema: schema,
    introspection: true,
    playground: true,
  });

  const port = process.env.GRAPHQL_SERVER_PORT || 4001;
  const path = process.env.GRAPHQL_SERVER_PATH || '/graphql';
  const host = process.env.GRAPHQL_SERVER_HOST || '0.0.0.0';

  server.applyMiddleware({ app, path });

  app.listen({ host, port, path }, () =>
    console.log(
      `🚀 Server ready at http://${host}:${port}${server.graphqlPath}`
    )
  );
};

startServer();
