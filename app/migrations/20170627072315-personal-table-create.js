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
            'personal',
            {

                userid: {
                    type: Sequelize.INTEGER,
                    primaryKey: true,
                    autoIncrement: true // Automatically gets converted to SERIAL for postgres
                },
                fname: {type: Sequelize.STRING},
                lname: {type: Sequelize.STRING},
                email: {type: Sequelize.STRING},
                pass: {type: Sequelize.STRING},
                home_working_environment: {type: Sequelize.STRING},
                computer_hardware: {type: Sequelize.STRING},
                speed_test: {type: Sequelize.STRING},
                image: {type: Sequelize.STRING},
                voice_path: {type: Sequelize.STRING},
                gender: {type: Sequelize.STRING},
                nationality: {type: Sequelize.STRING},
                bday: {type: Sequelize.STRING},
                bmonth: {type: Sequelize.STRING},
                byear: {type: Sequelize.STRING},
                permanent_residence: {type: Sequelize.STRING},
                dateupdated: {type: Sequelize.DATE},
                datecreated: {type: Sequelize.DATE},
                skype_id: {type: Sequelize.STRING},
                tel_no: {type: Sequelize.STRING},
                handphone_no: {type: Sequelize.STRING},
                address1: {type: Sequelize.STRING},
                headset_quality: {type: Sequelize.STRING},
                internet_connection: {type: Sequelize.STRING},
                alt_email: {type: Sequelize.STRING},
                postcode: {type: Sequelize.STRING},
                state: {type: Sequelize.STRING},
                city: {type: Sequelize.STRING},
                pregnant: {type: Sequelize.STRING},
                pending_visa_application: {type: Sequelize.STRING},
                active_visa: {type: Sequelize.STRING},
                linked_in: {type: Sequelize.STRING},
                facebook_id: {type: Sequelize.STRING},
                marital_status: {type: Sequelize.STRING},
                handphone_country_code: {type: Sequelize.STRING},
                tel_area_code: {type: Sequelize.STRING},
                auth_no_type_id: {type: Sequelize.STRING},
                msia_new_ic_no: {type: Sequelize.STRING},
                icq_id: {type: Sequelize.STRING},
                referred_by: {type: Sequelize.STRING}
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
            'personal'
        );
    }
};