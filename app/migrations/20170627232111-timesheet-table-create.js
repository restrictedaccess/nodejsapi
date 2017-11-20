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
            'timesheet',
            {
                id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
                leads_id : {type: Sequelize.INTEGER},
                userid : {type: Sequelize.INTEGER},
                subcontractors_id : {type: Sequelize.INTEGER},
                month_year: {type: Sequelize.DATE},
                date_generated: {type:Sequelize.DATE},
                status: {type:Sequelize.STRING},
                notify_staff_invoice_generator: {type:Sequelize.STRING},
                notify_client_invoice_generator: {type:Sequelize.STRING},
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
            'timesheet'
        );
    }
};