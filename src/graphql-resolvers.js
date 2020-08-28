const neo4j = require('neo4j-driver');
const _ = require('lodash');

const { randomColor } = require('./utils/randomColour');
const { slugify } = require('./utils/createSlug');
const { result } = require('lodash');

const buildSessionParams = (ctx) => {
  let paramObj = {};

  if (ctx.neo4jDatabase) {
    paramObj['database'] = ctx.neo4jDatabase;
  }

  if (ctx.neo4jBookmarks) {
    paramObj['bookmarks'] = ctx.neo4jBookmarks;
  }
  return paramObj;
};

const runQuery = async (query, context, resolveInfo) => {
  if (context.neo4jDatabase || context.neo4jBookmarks) {
    const sessionParams = buildSessionParams(context);
    try {
      // connect to the specified database and/or use bookmarks
      // must be using 4.x version of driver
      session = context.driver.session(sessionParams);
    } catch (e) {
      // throw error if bookmark is specified as failure is better than ignoring user provided bookmark
      if (context.neo4jBookmarks) {
        throw new Error(
          `context.neo4jBookmarks specified, but unable to set bookmark in session object: ${e.message}`
        );
      }
    }
  } else {
    // no database or bookmark specified
    session = context.driver.session();
  }

  let result;

  try {
    result = await session.writeTransaction((tx) => tx.run(query));
    result = result.records[0].get(0);
  } finally {
    session.close();
  }
  return result.properties;
};

const resolvers = {
  Mutation: {
    userCreateBusiness: async (obj, args, context, resolveInfo) => {
      const {
        userId,
        name,
        description,
        displayImage,
        gallery,
        bannerImage,
      } = args.input;
      /**
       * first, create the business object
       * second, attack business to user object
       * third, connect auxilliary objects IF they exist
       */
      const createBusiness = `
       MATCH (u: User {userId: "${userId}"})
       MERGE (b: Business:Contactable:Ownable:ContentMetaReference { name: "${name}", businessId: apoc.create.uuid(), description: "${description}", bannerColour: "${randomColor()}", slug: "${slugify(
        name,
        {
          lower: true,
          remove: /[*+~.()'"!:@]/g,
        }
      )}", dateCreated: toInteger(${Date.now()}) })<-[r:MANAGES]-(u)
        RETURN b
       `;
      return await runQuery(createBusiness, context, resolveInfo);
    },
  },
  Business: {
    dateCreated: (obj, args, context, resolveInfo) => {
      return Number(obj.dateCreated);
    },
  },
};

module.exports = { resolvers };
