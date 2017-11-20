'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });


     admin_id: {type: Sequelize.INTEGER},
     currency: {type: Sequelize.STRING},
     rate: {type:Sequelize.DECIMAL(12, 2)},
     effective_date: {type: Sequelize.DATE},
     status: {type: Sequelize.STRING},
     date_added: {type: Sequelize.DATE},
     date_executed: {type: Sequelize.DATE},


     */
      queryInterface.createTable(
          'scheduled_currency_adjustments',
          {
              id: {
                  type: Sequelize.INTEGER,
                  primaryKey: true,
                  autoIncrement: true
              },
              admin_id: {
                  type: Sequelize.INTEGER
              },
              currency: {
                  type: Sequelize.STRING
              },
              rate: {
                  type: Sequelize.DECIMAL(12, 2)
              },
              effective_date: {
                  type: Sequelize.DATE
              },
              status: {
                  type: Sequelize.STRING
              },
              date_added: {
                  type: Sequelize.DATE
              },
              date_executed: {
                  type: Sequelize.DATE
              },
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
          'scheduled_currency_adjustments'
      );
  }
};
