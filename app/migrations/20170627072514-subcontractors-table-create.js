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
            'subcontractors',
            {
                id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
                job_designation: {type: Sequelize.STRING},
                leads_id: {type: Sequelize.INTEGER},
                userid: {type: Sequelize.INTEGER},
                staff_email: {type: Sequelize.STRING},
                client_price: {type: Sequelize.FLOAT},
                work_status: {type: Sequelize.STRING},
                resignation_date: {type: Sequelize.DATE},
                date_terminated: {type: Sequelize.DATE},
                starting_date: {type: Sequelize.DATE},
                end_date: {type: Sequelize.DATE},
                status: {type: Sequelize.STRING},
                reason: {type: Sequelize.STRING},
                prepaid: {type: Sequelize.STRING},
                overtime: {type: Sequelize.STRING},
                current_rate: {type: Sequelize.STRING},
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
            'subcontractors'
        );
    }
};