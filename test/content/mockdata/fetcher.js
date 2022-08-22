const admins = require("./MOCK_DATA_ADMINS.json");

const getMockAllAdmins = () => {
  return {
    data: admins,
  };
};

const getMockNbAdmins = (number) => {
  var listNbAdmins = [];
  var allAdmins = getMockAllAdmins().data.admins;
  if (allAdmins.length == 0) throw new Error("Mockdata empty?");
  if (number == 0) throw new Error("whY?");
  if (number < 0) throw new Error("negative number in parameter");
  if (number > allAdmins.length)
    throw new Error("number in parameter is out of bound");

  listNbAdmins = allAdmins.slice(0, number);

  return {
    data: listNbAdmins,
  };
};
module.exports = { getMockAllAdmins, getMockNbAdmins };
