/* DB scheme */

const dbScheme = {
	users: {
		userId: {
			type: 'integer',
			primKey: true,
      autoIncrement: true,
		},
		login: {
			type: 'text',
			unique: true,
		},
		password: {
			type: 'text',
		},
		expTime: {
			type: 'integer',
			default: 0,
		}
	},

	history: {
		id: {
			type: 'integer',
			primKey: true,
      autoIncrement: true,
		},
		userId: {
			type: 'integer',
      references: {
				table: 'users',
				field: 'userId',
			}
		},
		message: {
			type: 'text',
		}
	},

}

module.exports = dbScheme
