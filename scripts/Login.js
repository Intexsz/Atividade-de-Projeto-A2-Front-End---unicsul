function logar(){

    // Aqui será cadastrado os usuarios que serão permitidos a entrada no site
    const usuarios = [
        { 
        usuario:"Fabricio",
        senha:"123"
        },
        {    
        usuario:"Thiago",
        senha:"1234"
        

        }, 
        {  
        usuario:"Daniel",
        senha:"1234"
        
        }
 

    ];

    // verificação 
    
    var usuario = document.getElementById('usuario').value;
    var senha = document.getElementById('senha').value;

    
    const usuarioValidado = usuarios.find(user=> 
      user.usuario === usuario &&
      user.senha === senha

    );
    if (usuarioValidado){

        alert("Login realizado com sucesso!!!");
        window.location.href = "tela_inicial.html";

    } else 
    {
       alert("Usuario ou senha incorretos!!!");

    }
}
