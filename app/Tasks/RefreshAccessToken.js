'use strict';

const Task = use('Task');
const Env = use('Env');
const Token = use('App/Models/Token');

// The credentials for Microsoft Graph
const credentials = {
	client: {
		id: '292802e3-a198-4e18-ab66-8ea5e7968922',
		secret: 'beguX64??cjmDDRVIJ676+!'
	},

	auth: {
		tokenHost: 'https://login.microsoftonline.com',
		authorizePath: 'common/oauth2/v2.0/authorize',
		tokenPath: 'common/oauth2/v2.0/token'
	}
};
const Oauth2 = require('simple-oauth2').create(credentials);

/**
 * Update the tokens in the database
 *
 * @param {*} token The tokens received from Graph (access token, refresh token and account information).
 */
async function saveToDatabase (token) {
	await Token.truncate();
	const accessTokenModel = new Token();
	accessTokenModel.token = token.token.access_token;
	accessTokenModel.type = 'access';
	accessTokenModel.save();
	const refreshTokenModel = new Token();
	refreshTokenModel.token = token.token.refresh_token;
	refreshTokenModel.type = 'refresh';
	refreshTokenModel.save();
}

class RefreshAccessToken extends Task {
	/**
	 * Run the scheduled task every half hour.
	 */
	static get schedule () {
		return '*/30 * * * *';
	}

	/**
	 * Update the tokens in the database.
	 */
	async handle () {
		const results = await Token.findBy('type', 'refresh');
		const refreshToken = results.toJSON().token;

		if (refreshToken) {
			const newToken = await Oauth2.accessToken.create({
				refresh_token: refreshToken
			}).refresh();

			saveToDatabase(newToken);
		}
	}
}

module.exports = RefreshAccessToken;
