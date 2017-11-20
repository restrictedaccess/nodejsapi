'use strict';

module.exports = {
    up: function (queryInterface, Sequelize) {
        /*
         Add altering commands here.
         Return a promise to correctly handle asynchronicity.

         Example:
         return queryInterface.createTable('users', { id: Sequelize.INTEGER });
         */
        queryInterface.createTable(
            'admin',
            {
                admin_id: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true // Automatically gets converted to SERIAL for postgres
                },
                admin_fname: {type: Sequelize.STRING},
                admin_lname: {type: Sequelize.STRING},
                admin_email: {type: Sequelize.STRING},
                signature_contact_nos: {type: Sequelize.STRING},
                signature_company: {type: Sequelize.STRING},
                currency_adjustment: {type: Sequelize.STRING},
            }
        );
    },

    down: function (queryInterface, Sequelize) {
        /*
         Add reverting commands here.
         Return a promise to correctly handle asynchronicity.

         Example:
         return queryInterface.dropTable('users');
         */
        queryInterface.dropTable(
            'admin'
        );
    }
};