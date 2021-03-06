const { hooks } = require('@adonisjs/ignitor');

hooks.after.providersBooted(() => {
	const Validator = use('Validator');
	// const sameFn = async (data, field, message, args) => {
	// if (!data[field]) {
	// return;
	// }

	// for (let arg in args) {
	// console.log(data[args[arg]]);
	// if (data[field] !== data[args[arg]]) {
	// throw message;
	// }
	// }
	// }

	/**
	 * Validator for limiting values of an input field.
	 *
	 * @param {Object} data Data sent through the request.
	 * @param {*} field Name of the field.
	 * @param {*} message Error message for violation.
	 * @param {*} args Arguments pass to the validator function.
	 */
	const onlyFn = async (data, field, message, args) => {
		if (!data[field]) {
			return;
		}

		let match = false;
		for (let arg in args) {
			if (data[field] === arg) {
				match = true;
				break;
			}
		}

		if (!match) {
			throw message;
		}
	};

	Validator.extend('only', onlyFn);
});
