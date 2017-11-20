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
          'currency_adjustments_regular_invoicing',
          {
              id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
              admin_id: {type: Sequelize.INTEGER},
              currency: {type: Sequelize.STRING},
              rate: {type: Sequelize.FLOAT},
              effective_month: {type: Sequelize.INTEGER},
              effective_year: {type: Sequelize.INTEGER},
              date_added: {type: Sequelize.DATE},
              date_updated: {type: Sequelize.DATE}
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
          'currency_adjustments_regular_invoicing'
      );
  }
};
