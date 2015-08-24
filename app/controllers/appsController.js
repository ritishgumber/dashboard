'use strict';

app.controller('appsController',
  ['$scope',
   'projectService', 
   '$http',
   '$rootScope',
   '$cookies', 
   '$intercom',
   '$timeout',
   'tableService',
   'beaconService',
  function ($scope,
  projectService,
  $http,
  $rootScope,
  $cookies,
  $intercom,
  $timeout,
  tableService,
  beaconService) {

  $rootScope.isFullScreen=false;
  $scope.showProject=[];
  $scope.newApp={
    name:null,
    appId:null
  };
  /*Collapse sidebar*/           
  toggleSideBar();
  
  $scope.init=function(){
        //Hiding the Menu
        $rootScope.page='apps';
        $scope.isLoading = [];
        $rootScope.dataLoading=true;
        $rootScope.showMenu=false;
        $rootScope.currentProject=null;
        $scope.showSaveBtn = true;
        $scope.appKeysText={
          appId:"Copy",
          masterKey:"Copy",
          javascriptKey:"Copy"
        }; 

        //Intercom integration   
        integrateIntercom();
        //listing start
        projectService.projectList()         
        .then(function(data){
          $rootScope.dataLoading=false; 
          $scope.projectListObj=data;

          //getBeacon
          getBeacon();                              
        },function(error){
          $rootScope.dataLoading=false; 
          errorNotify('Cannot connect to server. Please try again.');
        });
         //listing ends                           
  };

  $scope.deleteAppModal=function(project, index){
      $scope.projectToBeDeleted=project;
      $scope.appIndex=index;
      $scope.projectToBeDeletedIndex=$scope.projectListObj.indexOf($scope.projectToBeDeleted);
      $scope.confirmAppName=null;
      $('#deleteappmodal').modal();
  };

  $scope.deleteProject = function(){               
      if ($scope.confirmAppName === null) { 
        $('#deleteappmodal').modal("hide");        
        WarningNotify('App name you entered was empty.');
        $scope.confirmAppName=null;   

      } else {
        if($scope.confirmAppName === $scope.projectToBeDeleted.name){

          $scope.isLoading[$scope.appIndex] = true;

          projectService.deleteProject($scope.projectToBeDeleted.appId)
          .then(function(){
            $scope.isLoading[$scope.appIndex] = false;
            $scope.toggleAppEdit($scope.appIndex);
            $scope.confirmAppName=null;
            $('#deleteappmodal').modal("hide");  
            //project is deleted.
            $scope.projectListObj.splice($scope.projectToBeDeletedIndex,1);
            successNotify('The project is successfully deleted.');                

          },function(error){
            $scope.confirmAppName=null;
            $('#deleteappmodal').modal("hide");  
            $scope.isLoading[$scope.appIndex] = false; 
            errorNotify('Cannot delete this project at this point in time. Please try again later.');
             
          });

        } else{  
          $scope.confirmAppName=null;
          $('#deleteappmodal').modal("hide"); 
          WarningNotify('App name doesnot match.');                  
        }                      
      }        
  };

  $scope.createProject=function(isValid){        
    $scope.appValidationError=null;
    if(isValid && $scope.newApp.name && $scope.newApp.appId){
      $scope.showSaveBtn = false;               
      $scope.appValidationError=null;

      projectService.createProject($scope.newApp.name, $scope.newApp.appId)     
      .then(function(data){

          if($scope.projectListObj.length==0){
            $scope.projectListObj=[];            
          }
          $scope.projectListObj.push(data); 

          $scope.showSaveBtn = true;
          $scope.isAppCreated = true;
          $scope.newApp.name="";
          $scope.newApp.appId = "";

          //Add default tables
          addDefaultTables(data);

          //Update Beacon
          if($scope.beacon && !$scope.beacon.firstApp){
            $scope.beacon.firstApp=true;
            updateBeacon();   
          }                
                       
        },function(error){
          $scope.showSaveBtn = true;
          if(error === 400){           
            errorNotify('App ID already exists. Please choose a different App ID.');
          }
          if(error === 500){           
            errorNotify('Cannot connect to server. Please try again.');  
          }
           
        });
    }
  }

  $scope.editProject=function(isValid,index,appObj,newName){

      if(isValid){

        $scope.isLoading[index] = true;

        var originalAppIndex=$scope.projectListObj.indexOf(appObj);        
        projectService.editProject(appObj.appId,newName)     
        .then(function(data){
          $scope.isLoading[index] = false;
          $scope.toggleAppEdit(index);

          $scope.projectListObj[originalAppIndex]=data;           
          successNotify('The project is successfully modified.');
        },function(error){
          $scope.isLoading[index] = false;
          $scope.editprojectError=error;  
          errorNotify(error);                     
        });

      }

  };

  $scope.goToTableDesigner=function(projectObj){
    //Setting Current Project
     $rootScope.currentProject=projectObj;

     /*Collapse sidebar*/           
      //toggleSideBar();

    //Update Beacon
    if($scope.beacon && !$scope.beacon.tableDesignerLink){
      $scope.beacon.tableDesignerLink=true;
      updateBeacon();   
    }

     //Redirect to Table designer
     window.location.href="/#/"+projectObj.appId+"/table";     
  };

  $scope.viewKeys=function(list){
    $scope.selectedProject=list;
    $('#keysModal').modal('show');
  };

  $scope.copyKeys=function(keyName){
      if(keyName=="appId"){
        $scope.appKeysText.appId="Copied!";
      }
      if(keyName=="masterKey"){
        $scope.appKeysText.masterKey="Copied!";
      }
      if(keyName=="javascriptKey"){
        $scope.appKeysText.javascriptKey="Copied!";
      }
    
     $timeout(function(){ 
        $scope.appKeysText={
          appId:"Copy",
          masterKey:"Copy",
          javascriptKey:"Copy"
        };
      }, 5000);         
      
  }; 

  $scope.toggleAppEdit=function(index){
    for(var i=0;i<$scope.showProject.length;++i){
      if(index!=i){
        $scope.showProject[i]=false;
      }
    }

    if($scope.showProject[index]==true){
      $scope.showProject[index]=false;
    }else if(!$scope.showProject[index] || $scope.showProject[index]==false){
      $scope.showProject[index]=true;
    }    
  };

  function addDefaultTables(project){
    CB.CloudApp.init(project.appId, project.keys.master);

    var roleTable = new CB.CloudTable("Role"); 

    tableService.saveTable(roleTable)
    .then(function(data){
      
      var userTable = new CB.CloudTable("User");          
      tableService.saveTable(userTable); 
    },function(error){
      errorNotify('Error in creating App. Try again');
      //delete the app
      $scope.projectListObj.splice($scope.projectListObj.indexOf(project),1);
      projectService.deleteProject(project.appId);                
    });
    
  }

  function integrateIntercom(){
    var user = {
        name: $.cookie('userFullname'),
        email: $.cookie('email'),
        created_at: Date.parse($.cookie('createdAt')),
        user_id : $.cookie('userId')
      };

    $intercom.boot(user);

  }

  function toggleSideBar(_this){
    var b = $("#sidebar-collapse")[0];
    var w = $("#cl-wrapper");
    var s = $(".cl-sidebar");
   
    $(".fa",b).removeClass("fa-angle-left").addClass("fa-angle-right");
    w.addClass("sb-collapsed");
    $.cookie('FLATDREAM_sidebar','closed',{expires:365, path:'/'});         
    //updateHeight();
  }

  //get Beacon Obj from backend
  function getBeacon(){
    beaconService.getBeacon()         
    .then(function(beaconObj){
        $scope.beacon=beaconObj; 
        //Start the beacon
        initBeacons();                           
    },function(error){      
    });
  }

  //update Beacon
  function updateBeacon(){   
    beaconService.updateBeacon($scope.beacon)         
    .then(function(beaconObj){
        //$scope.beacon=beaconObj;                            
    },function(error){      
    });
  } 

  function initBeacons(){
    var x = 0;
    addCircleToFirstApp(x);
    addCircleToCreateApp(x);
    setInterval(function () {
        if (x === 0) {
            x = 1;
        }
        addCircleToFirstApp(x);
        addCircleToCreateApp(x);
        x++;
    }, 1200);
  }

  function addCircleToFirstApp(id) {
      $('.first-app-beacon-container').append('<div  id="' + id + '" class="circlepulse first-app-beacon"></div>');

      $('#' + id).animate({
          'width': '50px',
          'height': '50px',
          'margin-top': '-20px',
          'margin-left': '-20px',
          'opacity': '0'
      }, 4000, 'easeOutCirc');

      setInterval(function () {
          $('#' + id).remove();
      }, 4000);
  }
  function addCircleToCreateApp(id) {
      $('.create-app-beacon-container').append('<div  id="' + id + '" class="circlepulse create-app-beacon"></div>');

      $('#' + id).animate({
          'width': '50px',
          'height': '50px',
          'margin-top': '-20px',
          'margin-left': '-20px',
          'opacity': '0'
      }, 4000, 'easeOutCirc');

      setInterval(function () {
          $('#' + id).remove();
      }, 4000);
  }

//Notification

function errorNotify(errorMsg){
  $.amaran({
      'theme'     :'colorful',
      'content'   :{
         bgcolor:'#EE364E',
         color:'#fff',
         message:errorMsg
      },
      'position'  :'top right'
  });
}

function successNotify(successMsg){
  $.amaran({
      'theme'     :'colorful',
      'content'   :{
         bgcolor:'#149600',
         color:'#fff',
         message:successMsg
      },
      'position'  :'top right'
  });
}

function WarningNotify(WarningMsg){
  $.amaran({
      'theme'     :'colorful',
      'content'   :{
         bgcolor:'#EAC004',
         color:'#fff',
         message:WarningMsg
      },
      'position'  :'top right'
  });
}    
  

}]);

