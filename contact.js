const buildContactRelevantInformation = async(msg) =>{ 
    const from = msg.from;
    const contact = await msg.getContact();
}

module.exports = {
    buildContactRelevantInformation
}