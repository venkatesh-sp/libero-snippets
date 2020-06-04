"use strict";
module.exports = (sequelize, DataTypes) => {
  const message = sequelize.define(
    "message",
    {
      userId: DataTypes.INTEGER,
      parentId: DataTypes.INTEGER,
      message: DataTypes.TEXT,
    },
    {}
  );
  message.associate = function (models) {
    // associations can be defined here
    message.belongsTo(models.user, { foreignKey: "userId", as: "user" });
    message.belongsTo(models.message, { foreignKey: "parentId", as: "parent" });
  };
  return message;
};
