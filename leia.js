const startChat = async ({ client, msgBody = '@RODOCLUBE API-CADASTRO', leiaId = '551140030407@c.us' }) => {
    const chat = await client.getChatById(leiaId);
    await chat.sendMessage(msgBody);
    return chat;
};

module.exports = {
    startChat
}

