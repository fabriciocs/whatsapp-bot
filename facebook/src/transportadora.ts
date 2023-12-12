/** crie uma class para representar uma transportadora 
 * entity Transportadora {
razaoSocial String required,
nomeFantasia String required,
cnpj String required,
inscricaoEstadual String required,
endereco String required,
telefone String required,
imagem ImageBlob,
listaDeProprietarios Proprietario
}
*/
export interface Transportadora {
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    telefone: string;
    imagem: string;
    listaDeProprietarios: Proprietario[];
}
export interface Proprietario {
    nome: string;
    cpf: string;
    telefone: string;
    email: string;
}