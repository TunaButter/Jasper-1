'use strict';

const User = use('App/Models/User');
const AccountRequest = use('App/Models/AccountRequest');
const Mail = use('Mail');
const Hash = use('Hash');
const Env = use('Env');

/**
 * Generating a random string.
 *
 * @param {Integer} times Each time a string of 5 to 6 characters is generated.
 */
function random (times) {
	let result = '';
	for (let i = 0; i < times; i++) {
		result += Math.random().toString(36).substring(2);
	}

	return result;
}

/**
 * Send an email.
 *
 * @param {string} subject  Subject of Email
 * @param {string} body     Body of Email
 * @param {string} to       Sending address
 * @param {string} from     Receiving address
 */
function sendMail (subject, body, to, from) {
	Mail.raw(body, (message) => {
		message
			.to(to)
			.from(from)
			.subject(subject);
	});
	console.log('mail sent');
}

class UserController {
	/**
	 * Create a new Enployee user. There is an option to verify the user directly
	 * or to make them verify their email address.
	 *
	 * @param {Object} Context The context object.
	 */
	async create ({ request, response, auth }) {
		const confirmationRequired = Env.get('REGISTRATION_CONFIRMATION', false);

		if (confirmationRequired) {
			return this.createWithVerifyingEmail({ request, response });
		} else {
			return this.createWithoutVerifyingEmail({ request, response, auth });
		}
	}

	/**
	 * Create and verify a new Enployee user. Save them to the database and log them in.
	 *
	 * @param {Object} Context The context object.
	 */
	async createWithoutVerifyingEmail ({ request, response, auth }) {
		var userInfo = request.only(['firstname', 'lastname', 'email', 'password', 'tower', 'floor']);
		userInfo.role = 2;
		userInfo.verified = true;
		const user = await User.create(userInfo);

		await auth.login(user);
		return response.redirect('/');
	}

	/**
	 * Create a new Enployee user and send a confirmation email to them.
	 *
	 * @param {Object} Context The context object.
	 */
	async createWithVerifyingEmail ({ request, response, auth }) {
		var userInfo = request.only(['firstname', 'lastname', 'email', 'password', 'tower', 'floor']);
		console.log(userInfo);
		userInfo.role = 2;
		userInfo.verified = false;

		let hash = random(4);

		let row = {
			email: userInfo.email,
			hash: hash,
			type: 2
		};
		await AccountRequest.create(row);

		let body = `
			<h2> Welcome to Jarvis, ${userInfo.firstname} </h2>
    		<p>
      			Please click the following URL into your browser: 
      			https://thejarvis-jarvis.7e14.starter-us-west-2.openshiftapps.com/newUser?hash=${hash}
    		</p>
    	`;

		await sendMail('Verify Email Address for Jarvis',
			body, userInfo.email, 'support@mail.cdhstudio.ca');

		await User.create(userInfo);
		return response.redirect('/login');
	}

	/**
	 * Verify the user's emaill address.
	 *
	 * @param {Object} Context The context object.
	 */
	async verifyEmail ({ request, response }) {
		const hash = request._all.hash;

		try {
			let results = await AccountRequest
				.query()
				.where('hash', '=', hash)
				.fetch();
			let rows = results.toJSON();
			console.log(rows);
			const email = rows[0].email;

			await User
				.query()
				.where('email', email)
				.update({ verified: true });

			return response.redirect('/');
		} catch (err) {
			console.log(err);
		}
	}

	/**
	 * Create and verify a new Admin user. Save them to the database and log them in.
	 *
	 * @param {Object} Context The context object.
	 */
	async createAdmin ({ request, response, auth }) {
		var adminInfo = request.only(['firstname', 'lastname', 'email', 'password']);
		adminInfo['role'] = 1;
		adminInfo['verified'] = 1;
		const user = await User.create(adminInfo);

		await auth.login(user);
		return response.redirect('/');
	}

	/**
	 * Log a user in and redirect them to their respective landing page depending on the user type.
	 *
	 * @param {Object} Context The context object.
	 */
	async login ({ request, auth, response, session }) {
		const { email, password } = request.all();

		const user = await User
			.query()
			.where('email', email)
			.where('verified', true)
			.first();

		try {
			await auth.attempt(user.email, password);
			if (auth.user.role === 2) {
				return response.redirect('/booking');
			} else {
				return response.redirect('/');
			}
		} catch (error) {
			session.flash({ loginError: 'These credentials do not work.' });
			return response.redirect('/login');
		}
	}

	/**
	 * Log a user out.
	 *
	 * @param {Object} Context The context object.
	 */
	async logout ({ auth, response }) {
		await auth.logout();
		return response.redirect('/');
	}

	async show ({ auth, params, view, response }) {
		const user = await User.find(Number(params.id));
		var canEdit = 0;
		var layoutType = '';
		// if user is admin
		if (auth.user.role === 1) {
			layoutType = 'layouts/adminLayout';
			canEdit = 1;
			// check if user is viewing their own profile
		} else if (auth.user.id === Number(params.id) && auth.user.role === 2) {
			layoutType = 'layouts/mainLayout';
			canEdit = 1;
			// check if user is viewing someone elses profile
		} else if (auth.user.id !== Number(params.id) && auth.user.role === 2) {
			layoutType = 'layouts/mainLayout';
			canEdit = 0;
		} else {
			return response.redirect('/');
		}

		console.log(auth.user.role);

		return view.render('auth.showUser', { auth, user, layoutType, canEdit });
	}

	/**
	 * Create a password reset request record in the database and send a confirmation email to the user.
	 *
	 * @param {Object} Context The context object.
	 */
	async createPasswordResetRequest ({ request, response }) {
		const email = request.body.email;
		const results = await User
			.query()
			.where('email', '=', email)
			.fetch();
		const rows = results.toJSON();

		if (rows.length !== 0) {
			let hash = random(4);

			let row = {
				email: email,
				hash: hash,
				type: 1
			};
			console.log(row);
			await AccountRequest.create(row);

			let body = `
      			<h2> Password Reset Request </h2>
      			<p>
        			We received a request to reset your password. If you asked to reset your password, please click the following URL: 
        			https://thejarvis-jarvis.7e14.starter-us-west-2.openshiftapps.com/newPassword?hash=${hash}
      			</p>
			`;

			await sendMail('Password Reset Request',
				body, email, 'support@mail.cdhstudio.ca');
		}

		return response.redirect('/login');
	}

	/**
	 * Verify the user's password reset hash code and redirect them to the password reset page.
	 *
	 * @param {Object} Context The context object.
	 */
	async verifyHash ({ request, view }) {
		const hash = request._all.hash;
		if (hash) {
			const results = await AccountRequest
				.query()
				.where('hash', '=', hash)
				.fetch();
			const rows = results.toJSON();
			console.log(hash);

			if (rows.length !== 0 && rows[0].type === 1) {
				const email = rows[0].email;

				return view.render('resetPassword', { email: email });
			}
		}
	}

	/**
	 * Update the user's password in the database.
	 *
	 * @param {Object} Context The context object.
	 */
	async resetPassword ({ request, response }) {
		console.log(request.body);
		const newPassword = await Hash.make(request.body.newPassword);
		const changedRow = await User
			.query()
			.where('email', request.body.email)
			.update({ password: newPassword });

		console.log(changedRow);
		return response.redirect('/login');
	}

	/**
	 * Update the user's password in the database.
	 *
	 * @param {Object} Context The context object.
	 */
	async changePassword ({ request, response, auth, params, session }) {
		if (auth.user.role === 1 || (auth.user.id === Number(params.id) && auth.user.role === 2)) {
			try {
				const passwords = request.only(['newPassword']);
        		const user = auth.user;  // eslint-disable-line
				const newPassword = await Hash.make(passwords.newPassword);

        		const changedRow = await User  // eslint-disable-line
					.query()
					.where('id', Number(params.id))
					.update({ password: newPassword });
				session.flash({ success: 'Password Updated Successfully' });
			} catch (error) {
				session.flash({ error: 'Password Update failed' });
				return response.redirect('/login');
			}

			return response.route('viewProfile', { id: Number(params.id) });
			// check if user is viewing their own profile
		} else {
			return response.redirect('/');
		}

		// if (isSame) {
		// const newPassword = await Hash.make(passwords.newPassword);
		// const changedRow = await User
		// .query()
		// .where('email', user.email)
		// .update({ password: newPassword });
		// console.log(changedRow);

		// return response.redirect('/');
		// }
	}
}

module.exports = UserController;
