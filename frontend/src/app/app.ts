import { Component, signal, computed } from '@angular/core';
import { JsonPipe } from '@angular/common'
import { Ingredient, RecipeModel } from './models';
import { MOCK_RECIPES } from './mock-recipes';
import { isNgTemplate } from '@angular/compiler';

@Component({
  selector: 'app-root',
  standalone: true,
  imports : [JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('My Recipe Box');
  protected readonly recipe = signal< RecipeModel | null >(null)
  protected readonly servings = signal<number>(1)
  protected readonly adjustedIngredients = computed<Ingredient[]>(() =>{
    const currentRecipe = this.recipe()
    if (!currentRecipe) {
      return []
    }
    return currentRecipe.ingredients.map(ing => ({
        ...ing,
        quantity: ing.quantity * this.servings()
      }));
    
  })
  incrementServings = () :void => {
    this.servings.update((valor : number) : number => valor + 1 )
  }

  decrementServigs = () : void => {
    this.servings.update((valor: number): number => valor > 1 ? valor - 1: 1)
  }

  
  bnt1 = () : void =>  {
    const spaghettiRecipe = MOCK_RECIPES[0]
    this.recipe.set(spaghettiRecipe)
    console.log(spaghettiRecipe)
  }
  
  bnt2 = () : void => {
    const saladRecipe = MOCK_RECIPES[1]
    this.recipe.set(saladRecipe)
    console.log(saladRecipe)
  }
}
