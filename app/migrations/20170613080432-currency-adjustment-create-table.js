module.exports = {
  up: (queryInterface, Sequelize) => {
    // logic for transforming into the new state
     queryInterface.createTable(
         'currency_adjustments',
         {
             id: {
                 type : Sequelize.INTEGER,
                 primaryKey : true, 
                 autoIncrement : true
             },
             admin_id:{
                 type:Sequelize.INTEGER
             },
             currency:{
                 type:Sequelize.STRING
             },
            rate:{
                type:Sequelize.FLOAT
            },
            effective_date:{
                type:Sequelize.DATE
            },
            active:{
                type:Sequelize.STRING
            },
            date_added:{
                type:Sequelize.DATE
            }            
         }
     )
  },

  down: (queryInterface, Sequelize) => {
    // logic for reverting the changes
    queryInterface.dropTable(
         'currency_adjustments'
    )
  }
}