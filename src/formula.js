//crie uma formula do google sheets para receber um valor e uma lista com as notas disponíveis e retornar a quantidade de cada nota necessária para chegar ao valor
//exemplo: 187,00 = 1 nota de 100,00 + 1 nota de 50,00 + 1 nota de 20,00 + 1 nota de 10,00 + 1 nota de 5,00 + 2 nota de 1,00
function notas(valor, notas) {
  var notas = notas.split(',').map(Number);
  var resultado = {};
  var i = 0;
  while (valor > 0) {
    if (valor >= notas[i]) {
      resultado[notas[i]] = resultado[notas[i]] ? resultado[notas[i]] + 1 : 1;
      valor -= notas[i];
    } else {
      i++;
    }
  
}
}