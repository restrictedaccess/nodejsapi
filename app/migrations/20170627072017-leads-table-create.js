'use strict';

module.exports = {
    up: function (queryInterface, Sequelize) {
        /*
         Add altering commands here.
         Return a promise to correctly handle asynchronicity.

         Example:
         return queryInterface.createTable('users', { id: Sequelize.INTEGER });


         id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
         fname: {type: Sequelize.STRING},
         lname: {type: Sequelize.STRING},
         email: {type: Sequelize.STRING},
         hiring_coordinator_id: {type: Sequelize.INTEGER},
         last_updated_date: {type: Sequelize.DATE},
         company_name: {type: Sequelize.STRING},
         company_address: {type: Sequelize.STRING},
         mobile: {type: Sequelize.STRING},
         status: {type: Sequelize.STRING},
         csro_id: {type: Sequelize.STRING},
         business_partner_id: {type: Sequelize.STRING},

         */

        queryInterface.createTable(
            'leads',
            {

                id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
                fname: {type: Sequelize.STRING},
                lname: {type: Sequelize.STRING},
                email: {type: Sequelize.STRING},
                hiring_coordinator_id: {type: Sequelize.INTEGER},
                last_updated_date: {type: Sequelize.DATE},
                company_name: {type: Sequelize.STRING},
                company_address: {type: Sequelize.STRING},
                mobile: {type: Sequelize.STRING},
                status: {type: Sequelize.STRING},
                csro_id: {type: Sequelize.STRING},
                business_partner_id: {type: Sequelize.STRING},
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
            'leads'
        );
    }
};