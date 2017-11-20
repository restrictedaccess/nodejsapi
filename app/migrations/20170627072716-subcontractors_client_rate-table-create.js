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
            'subcontractors_client_rate',
            {
                id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
                subcontractors_id: {type: Sequelize.INTEGER},
                start_date: {type: Sequelize.DATE},
                end_date: {type: Sequelize.DATE},
                rate: {type: Sequelize.FLOAT},
                client_price: {type: Sequelize.FLOAT},
                work_status: {type: Sequelize.STRING},
                date_added: {type: Sequelize.DATE},
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
            'subcontractors_client_rate'
        );
    }
};