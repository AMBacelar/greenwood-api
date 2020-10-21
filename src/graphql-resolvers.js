const neo4j = require('neo4j-driver');
const _ = require('lodash');

const { randomColor } = require('./utils/randomColour');
const { slugify } = require('./utils/createSlug');
const { result } = require('lodash');
const { createAccessToken, createRefreshToken } = require('./utils/auth');
const { sendRefreshToken } = require('./sendRefreshToken');
const { verify } = require('jsonwebtoken');

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

const runQuery = async (query, context, resolveInfo, built = true) => {
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

  result = await session.writeTransaction((tx) => tx.run(query));
  result = result.records[0].get(0);
  session.close();
  return built ? result.properties : result;
};

const authFunctions = {
  authenticate: async (obj, args, context, resolveInfo) => {
    const { fieldName, id, displayName, email } = args;
    const findUser = `
    MATCH (user: User {${fieldName}: "${id}"})
    RETURN user { .userId, .displayName, contact: head([(user)-[:HAS_CONTACT]->(user_contact:Contact) | user_contact { .email }]) } AS user`;
    const createUser = `
    CREATE (user:User:Contactable:ContentMetaReference { userId: apoc.create.uuid(), ${fieldName}: "${id}", displayName: "${displayName}" })-[:HAS_CONTACT]->(c:Contact { contactId: apoc.create.uuid(), email: ["${email}"]})
    RETURN user { .userId, .displayName, contact: head([(user)-[:HAS_CONTACT]->(user_contact:Contact) | user_contact { .email }]) } AS user`;
    let user;
    try {
      user = await runQuery(findUser, context, resolveInfo, false);
    } catch (error) {
      user = await runQuery(createUser, context, resolveInfo, false);
    } finally {
      sendRefreshToken(context.res, createRefreshToken(user));
      return {
        accessToken: createAccessToken(user),
        user,
      };
    }
  },
  refreshToken: async (obj, args, context, resolveInfo) => {
    const token = context.req.cookies['grnwood-network-refresh'];
    if (!token) {
      return res.send({ ok: false, accessToken: '' });
    }

    let payload = null;
    try {
      payload = verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      console.log(err);
      return res.send({ ok: false, accessToken: '' });
    }

    const findUser = `
    MATCH (user: User { userId: "${payload.userId}"})
    RETURN user { .userId, .displayName, contact: head([(user)-[:HAS_CONTACT]->(user_contact:Contact) | user_contact { .email }]) } AS user`;

    let user;
    try {
      user = await runQuery(findUser, context, resolveInfo, false);
    } catch (error) {
      if (!user) {
        return res.send({ ok: false, accessToken: '' });
      }
      console.log(error);
    } finally {
      sendRefreshToken(context.res, createRefreshToken(user));
      return {
        accessToken: createAccessToken(user),
        ok: true,
      };
    }
  },
};

const resolvers = {
  Query: {
    ...authFunctions,
  },
  Mutation: {
    ...authFunctions,
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
