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
            'timesheet_details',
            {
                id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
                timesheet_id : {type: Sequelize.INTEGER},
                day: {type: Sequelize.INTEGER},
                total_hrs: {type:Sequelize.FLOAT},
                adj_hrs: {type:Sequelize.FLOAT},
                regular_rostered: {type:Sequelize.FLOAT},
                hrs_charged_to_client: {type:Sequelize.FLOAT},
                diff_charged_to_client: {type:Sequelize.FLOAT},
                hrs_to_be_subcon: {type:Sequelize.FLOAT},
                diff_paid_vs_adj_hrs: {type:Sequelize.FLOAT},
                status:{type:Sequelize.STRING},
                reference_date:{type:Sequelize.DATE},
                notes_locked_date:{type:Sequelize.DATE},
                note_status:{type:Sequelize.STRING},
                note_done_date:{type:Sequelize.DATE},
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
            'timesheet_details'
        );
    }
};