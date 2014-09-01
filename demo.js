$(document).ready(function() {



    Test = Unit (
        function () {
            console.log("Test");
        }, "Test Unit");




    m = new Module(function(){





        this.Unit (
            function (inA, inB) {
                this.yield({
                    "outA": inA + inB,
                    "outB": 3
                });
            }, "Unit m1")
            .connect({
                "inA": "w1",
            }, "level")
            .connect({
                "inB": "w2",
                "outA": "w3",
                "outB": "w4"
            });



        this.Unit (
            function (inA, inB) {
                this.yield({
                    "outA": inA - inB,
                    "outB": 33
                });
            }, "Unit m2")
            .connect({
                "inA": "w3",
                "inB": "w4",
                "outA": "w5",
                "outB": "w6"
            });


        this.Unit (
            function (inC) {
                console.log(inC);
                //throw Error("qaaa");
            }, "Unit m3")
            .connect({"inC": "w5"});



        this.Unit(Test);

        this.Unit (
            function () {
                console.log("Test");
            }, "Test Unit");




        this.Storage({
            "store": {
                "w3": "data1",
                "w5": "data2"
            },
            "log": {
                "w1": "data3"
            }
        });



        this.Module(function(){
            this.Unit(function(p1, p2){
                this.yield({"p3": p2, "p4": p1});

            }, "Test Unit 2")
            .connect({"p1": "p1", "p2": "p2", "p3": "p3"})
            .connect({"p4": "p4"}, "level");

        }, "Test Module")
        .connect({"p4": "w1", "p2": "w1", "p1": "w3", "p2": "w4"});




    }, "Main module");
        
});

